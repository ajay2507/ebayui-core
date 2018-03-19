const throttle = require('lodash.throttle');
const emitAndFire = require('../../common/emit-and-fire');
const processHtmlAttributes = require('../../common/html-attributes');
const observer = require('../../common/property-observer');
const template = require('./template.marko');

const constants = {
    types: {
        discrete: 'discrete',
        continuous: 'continuous'
    },
    margin: 16 // matches the css applied to each item
};
const defaults = {
    type: constants.types.continuous
};

function getInitialState(input) {
    const items = (input.items || []).map((item) => ({
        htmlAttributes: processHtmlAttributes(item),
        renderBody: item.renderBody
    }));
    const type = input.type || defaults.type;
    return {
        index: 0,
        firstVisibleIndex: 0,
        lastVisibleIndex: 0,
        type,
        isContinuous: type === constants.types.continuous,
        isDiscrete: type === constants.types.discrete,
        prevControlDisabled: true,
        nextControlDisabled: false,
        ariaLabelPrev: input.ariaLabelPrev,
        ariaLabelNext: input.ariaLabelNext,
        classes: ['carousel', `carousel--${type}`, input.class],
        htmlAttributes: processHtmlAttributes(input),
        translation: 0,
        items
    };
}

function getTemplateData(state) {
    return state;
}

function init() {
    this.itemCache = [];
    this.listEl = this.el.querySelector('.carousel__list');
    this.itemEls = this.listEl.children;
    this.lastIndex = this.itemEls.length - 1;
    observer.observeRoot(this, ['index']);
    this.calculateWidths();
    this.performSlide(this.state.index);
    this.subscribeTo(window).on('resize', throttle(() => this.resizeHandler(), 100));
}

function update_index(newIndex) { // eslint-disable-line camelcase
    this.performSlide(parseInt(newIndex));
}

function resizeHandler() {
    this.calculateWidths(true);
    this.performSlide(parseInt(this.state.index));
}

function handleNext() {
    let newIndex = -1;

    if (!this.state.nextControlDisabled) {
        if (this.state.isContinuous) {
            newIndex = this.calculateNextIndex();
        } else if (this.state.isDiscrete) {
            newIndex = this.state.index + 1;
        }

        if (newIndex > this.lastIndex) {
            newIndex = this.lastIndex;
        }

        emitAndFire(this, 'carousel-next');
        this.setState('index', newIndex);
    }
}

function handlePrev() {
    const firstIndex = 0;
    let newIndex = -1;

    if (!this.state.prevControlDisabled) {
        if (this.state.isContinuous) {
            newIndex = this.calculatePrevIndex();
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
    if (index >= 0 && index <= this.lastIndex) {
        this.moveToIndex(index);
        this.updateControls();
    }
    this.update(); // FIXME: why won't it rerender on its own?
}

/**
 * Update button attributes based on current position
 */
function updateControls() {
    this.setState('prevControlDisabled', this.state.index === 0);
    this.setState('nextControlDisabled', this.state.stop || this.state.index === this.lastIndex);
}

/**
 * Move carousel position to an index
 * @param {Number} index
 */
function moveToIndex(index) {
    // if items width is smaller than container, then don't translate
    const shouldNotMove = this.allItemsWidth < this.containerWidth;
    if (shouldNotMove) {
        this.setState('stop', true); // TODO: refactor stop uasge
    } else {
        const widthBeforeIndex = this.getWidthBeforeIndex(index);
        let translation = (-1 * widthBeforeIndex);
        const maxTranslation = -1 * (this.allItemsWidth - this.containerWidth);
        if (translation < maxTranslation) {
            translation = maxTranslation;
            this.setState('stop', true);
        } else {
            this.setState('stop', false);
        }

        if (translation !== this.state.translation) {
            this.setState('translation', translation);
            emitAndFire(this, 'carousel-translate');
        }

        // TODO: set child links to tabindex=-1 when aria-hidden=true
        this.setState('firstVisibleIndex', this.calculateFirstVisibleIndex());
        this.setState('lastVisibleIndex', this.calculateLastVisibleIndex());
    }
}

function getAllItemsWidth() {
    return this.getWidthBeforeIndex(this.lastIndex + 1);
}

function calculateNextIndex() {
    let index = this.state.index;
    let containerWidth = this.containerWidth + constants.margin;

    const lastVisibleIndex = this.calculateLastVisibleIndex();
    index = lastVisibleIndex + 1;

    // check if we'll hit the right end
    const widthAfterCurrentIndex = this.getWidthAfterIndex(lastVisibleIndex);
    if (widthAfterCurrentIndex < containerWidth) {
        containerWidth = widthAfterCurrentIndex;
        index--;
    }

    return index;
}

function calculatePrevIndex() {
    let index = this.state.index;
    let containerWidth = this.containerWidth + constants.margin;

    // check if we'll hit the left end
    const widthBeforeCurrentIndex = this.getWidthBeforeIndex(this.state.index);
    if (widthBeforeCurrentIndex < containerWidth) {
        containerWidth = widthBeforeCurrentIndex;
        return 0;
    }

    if (this.state.nextControlDisabled) {
        index = this.calculateFirstVisibleIndex() - 1;
    }

    const prevIndex = this.widthLoop(index, -1, containerWidth) + 1;

    return prevIndex;
}

function widthLoop(startIndex, direction, containerWidth) {
    let index = startIndex;
    let remainingWidth = containerWidth;

    while (remainingWidth > 0) {
        remainingWidth -= this.getItemWidth(index);
        if (index > this.lastIndex || index < 0 || remainingWidth < 0) {
            break;
        }
        remainingWidth -= constants.margin;
        index += direction;
    }

    return index;
}

function calculateFirstVisibleIndex() {
    if (!this.state.nextControlDisabled) {
        return this.state.index;
    }

    // if carousel is all the way on right side, need to calculate manually
    const containerWidth = this.containerWidth + constants.margin;
    return this.widthLoop(this.lastIndex, -1, containerWidth) + 1;
}

function calculateLastVisibleIndex() {
    const containerWidth = this.containerWidth + constants.margin;
    return this.widthLoop(this.state.index, 1, containerWidth) - 1;
}

/**
 * Get the aggregate width of all items in the carousel until this index
 */
function getWidthBeforeIndex(index) {
    const fullWidth = index > this.lastIndex;
    const loopIndex = fullWidth ? this.lastIndex + 1 : index;
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
 * Get the aggregate width of all items in the carousel after (and including) this index
 */
function getWidthAfterIndex(index) {
    let width = 0;
    for (let i = index; i <= this.lastIndex; i++) {
        width += this.getItemWidth(i) + constants.margin;
    }
    width -= constants.margin;

    return width;
}

/**
 * Calculate and store widths of container and items
 * @params {Boolean} forceUpdate: Updates the cache with new values
 */
function calculateWidths(forceUpdate) {
    this.allItemsWidth = this.getAllItemsWidth();
    this.containerWidth = this.getContainerWidth();
    for (let i = 0; i <= this.lastIndex; i++) {
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
    } else if (index >= 0 && index <= this.lastIndex) {
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
    resizeHandler,
    handleNext,
    handlePrev,
    performSlide,
    updateControls,
    calculateNextIndex,
    calculatePrevIndex,
    getAllItemsWidth,
    moveToIndex,
    widthLoop,
    calculateFirstVisibleIndex,
    calculateLastVisibleIndex,
    getWidthBeforeIndex,
    getWidthAfterIndex,
    calculateWidths,
    getItemWidth,
    getContainerWidth
});

module.exports.privates = { constants, defaults };
