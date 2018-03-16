const throttle = require('lodash.throttle');
const emitAndFire = require('../../common/emit-and-fire');
const processHtmlAttributes = require('../../common/html-attributes');
const observer = require('../../common/property-observer');
const template = require('./template.marko');

const constants = {
    classes: {
        list: 'carousel__list'
    },
    types: {
        discrete: 'discrete',
        continuous: 'continuous'
    },
    margin: 16 // matches the css applied to each item
};
const defaults = {
    index: 0,
    type: constants.types.continuous
};

function getInitialState(input) {
    const items = (input.items || []).map((item) => ({
        htmlAttributes: processHtmlAttributes(item),
        renderBody: item.renderBody
    }));
    const index = parseInt(input.index) || defaults.index;
    const type = input.type || defaults.type;
    return {
        index,
        type,
        isContinuous: type === constants.types.continuous,
        isDiscrete: type === constants.types.discrete,
        prevControlDisabled: index === 0,
        nextControlDisabled: false,
        ariaLabelPrev: input.ariaLabelPrev,
        ariaLabelNext: input.ariaLabelNext,
        classes: ['carousel', `carousel--${type}`, input.class],
        htmlAttributes: processHtmlAttributes(input),
        items
    };
}

function getTemplateData(state) {
    return state;
}

function init() {
    this.itemCache = [];
    this.setupItems();
    observer.observeRoot(this, ['index']);
    this.calculateWidths();
    this.performSlide(this.state.index);
    this.subscribeTo(window).on('resize', throttle(() => this.resizeHandler(), 100));
}

function update_index(newIndex) { // eslint-disable-line camelcase
    this.performSlide(parseInt(newIndex));
}

function setupItems() {
    this.listEl = this.el.querySelector(`.${constants.classes.list}`);
    this.itemEls = this.listEl.children;
    this.setState('lastIndex', this.itemEls.length - 1);
}

function resizeHandler() {
    this.calculateWidths(true);
    this.performSlide(parseInt(this.state.index));
}

function handleNext() {
    let newIndex = -1;

    if (!this.state.nextControlDisabled && this.state.index <= this.state.lastIndex) {
        if (this.state.isContinuous) {
            // TODO: avoid calling calculateIndexChange multiple times in response to UI
            newIndex = this.state.index + this.calculateIndexChange(this.state.index, 1);
        } else if (this.state.isDiscrete) {
            newIndex = this.state.index + 1;
        }

        if (newIndex > this.state.lastIndex) {
            newIndex = this.state.lastIndex;
        }

        emitAndFire(this, 'carousel-next');
        this.setState('index', newIndex);
    }
}

function handlePrev() {
    const firstIndex = 0;
    let newIndex = -1;

    if (!this.state.prevControlDisabled && this.state.index > firstIndex) {
        if (this.state.isContinuous) {
            newIndex = this.state.index - this.calculateIndexChange(this.state.index, -1);
        } else if (this.state.isDiscrete) {
            newIndex = this.state.index - 1;
        }

        if (newIndex < firstIndex) {
            newIndex = firstIndex;
        }

        emitAndFire(this, 'carousel-prev');
        this.setState('index', newIndex);
    }
}

function performSlide(index) {
    if (index >= 0 && index <= this.state.lastIndex) {
        this.moveToIndex(index);
        this.updateControls();
    }
}

/**
 * Update button attributes based on current position
 */
function updateControls() {
    const oldPrevControlDisabled = this.state.prevControlDisabled;
    const oldNextControlDisabled = this.state.nextControlDisabled;
    this.setState('prevControlDisabled', this.state.index === 0);
    this.setState('nextControlDisabled', this.state.stop || this.state.index === this.state.lastIndex);

    if (this.state.prevControlDisabled !== oldPrevControlDisabled
     || this.state.nextControlDisabled !== oldNextControlDisabled) {
        this.update(); // FIXME: why won't it rerender on its own?
    }
}

/**
 * Move carousel position to an index
 * @param {Number} index
 */
function moveToIndex(index) {
    // const targetIndex = index + this.calculateIndexChange(index, 1);

    // if items width is smaller than container, then don't translate
    const shouldNotMove = this.getAllItemsWidth() < this.containerWidth;
    if (shouldNotMove) {
        this.setState('stop', true);
    } else {
        const widthBeforeIndex = this.getWidthBeforeIndex(index);
        let translation = (-1 * widthBeforeIndex);
        const maxTranslation = -1 * (this.getAllItemsWidth() - this.containerWidth);
        if (translation < maxTranslation) {
            translation = maxTranslation;
            this.setState('stop', true);
        } else {
            this.setState('stop', false);
        }

        this.listEl.style.transform = `translateX(${translation}px)`;
        emitAndFire(this, 'carousel-translate');
    }
}

function getAllItemsWidth() {
    return this.getWidthBeforeIndex(this.state.lastIndex + 1);
}

/**
 * Calculate the diff from startIndex based on item widths
 * @param {Number} startIndex: Index position to calculate from
 * @param {Number} direction: 1 for forward, -1 for backward
 */
function calculateIndexChange(startIndex, direction) {
    let diff = 0;
    let index = startIndex;
    const widthBuffer = 5;
    // add margin to compensate for last item not having margin
    let containerWidth = this.containerWidth + widthBuffer + constants.margin;
    const allItemsWidth = this.getAllItemsWidth();
    let willHitEnd = false;

    if (allItemsWidth > containerWidth && allItemsWidth - containerWidth < containerWidth) {
        containerWidth = allItemsWidth - containerWidth;
        willHitEnd = true;
    }

    while (containerWidth > 0) {
        if (index > this.state.lastIndex || index < 0) {
            break;
        }
        containerWidth -= this.getItemWidth(index);
        diff++;
        index += direction;
        containerWidth -= constants.margin;
    }

    return willHitEnd ? diff : diff - 1;
}

/**
 * Get the aggregate width of all items in the carousel until this index
 */
function getWidthBeforeIndex(index = 0) {
    const fullWidth = index > this.state.lastIndex;
    const loopIndex = fullWidth ? this.state.lastIndex + 1 : index;
    let width = 0;

    for (let i = 0; i < loopIndex; i++) {
        width += this.getItemWidth(i) + constants.margin;
    }

    if (fullWidth) {
        width -= constants.margin;
    }

    return width;
}

/**
 * Calculate and store widths of container and items
 * @params {Boolean} forceUpdate: Updates the cache with new values
 */
function calculateWidths(forceUpdate) {
    this.containerWidth = this.getContainerWidth();
    for (let i = 0; i <= this.state.lastIndex; i++) {
        this.getItemWidth(i, forceUpdate);
    }
}

/**
 * Get single item width based on index
 * @params {Number} index: Index of the carousel item
 * @params {Boolean} forceUpdate: Trigger fetch update of cache values
 */
function getItemWidth(index, forceUpdate) {
    if (this.itemCache && this.itemCache[index] && !forceUpdate) {
        return this.itemCache[index];
    } else if (index >= 0 && index <= this.state.lastIndex) {
        const rect = this.itemEls[index].getBoundingClientRect();
        this.itemCache[index] = rect.width || 0;
        return this.itemCache[index];
    }

    return 0;
}

function getContainerWidth() {
    const rect = this.listEl.getBoundingClientRect();
    return rect.width || 0;
}

module.exports = require('marko-widgets').defineComponent({
    template,
    init,
    getInitialState,
    getTemplateData,
    update_index,
    setupItems,
    resizeHandler,
    handleNext,
    handlePrev,
    performSlide,
    updateControls,
    calculateIndexChange,
    getAllItemsWidth,
    moveToIndex,
    getWidthBeforeIndex,
    calculateWidths,
    getItemWidth,
    getContainerWidth
});

module.exports.privates = { constants, defaults };
