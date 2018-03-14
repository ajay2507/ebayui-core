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
    this.bindEventListeners();
    observer.observeRoot(this, ['index']);
    this.calculateWidths();
    this.performSlide(this.state.index);
}

function update_index(newIndex) { // eslint-disable-line camelcase
    this.performSlide(parseInt(newIndex));
}

function setupItems() {
    this.listEl = this.el.querySelector(`.${constants.classes.list}`);
    this.itemEls = this.listEl.children;
    this.setState('totalItems', this.itemEls.length);
}

function bindEventListeners() {
    this.subscribeTo(window).on('resize', throttle(() => {
        this.calculateWidths(true);
        this.performSlide(parseInt(this.state.index));
    }));
}

function handleNext() {
    if (this.state.nextControlDisabled) {
        return;
    }

    emitAndFire(this, 'carousel-next');

    const lastIndex = this.state.totalItems - 1;
    let newIndex = -1;

    if (this.state.index === lastIndex) {
        return;
    }

    if (this.state.isContinuous) {
        newIndex = this.state.index + this.calculateTargetIndex(this.state.index, 1);
    } else if (this.state.isDiscrete) {
        newIndex = this.state.index + 1;
    }

    if (newIndex > lastIndex) {
        newIndex = lastIndex;
    }

    this.setState('index', newIndex);
}

function handlePrev() {
    if (this.state.prevControlDisabled) {
        return;
    }

    emitAndFire(this, 'carousel-prev');

    const firstIndex = 0;
    let newIndex = -1;

    if (this.state.index === firstIndex) {
        return;
    }

    if (this.state.isContinuous) {
        newIndex = this.state.index - this.calculateTargetIndex(this.state.index, -1);
    } else if (this.state.isDiscrete) {
        newIndex = this.state.index - 1;
    }

    if (newIndex < firstIndex) {
        newIndex = firstIndex;
    }

    this.setState('index', newIndex);
}

function performSlide(index) {
    if (index >= 0 && index < this.state.totalItems) {
        this.moveToIndex(index);
        this.updateControls();
    }
}

/**
 * Update button attributes based on current position
 */
function updateControls() {
    this.setState('prevControlDisabled', this.state.index === 0);
    this.setState('nextControlDisabled', this.state.stop === this.state.totalItems);
    this.update(); // FIXME: why won't it rerender on its own?
}

/**
 * Move carousel position to an index
 * @param {Number} index
 */
function moveToIndex(index) {
    const endIndex = index + this.calculateTargetIndex(index, 1) + 1;
    this.setState('stop', endIndex - 1);

    if (endIndex > this.state.totalItems) {
        this.setState('stop', this.state.totalItems);
    }

    // TODO (look into this) case where items are smaller than available width
    if (this.state.index === 0 && this.state.stop === this.state.totalItems) {
        return;
    }

    const widthBeforeIndex = this.getWidthBeforeIndex(index);
    const offset = this.getOffset(widthBeforeIndex, index, endIndex);
    this.listEl.style.transform = `translateX(${(-1 * widthBeforeIndex) + offset}px)`;
    emitAndFire(this, 'carousel-translate');
}

/**
 * Calculate the number of cards to scroll from startIndex based on their widths
 * @param {Number} startIndex: Index position to calculate from
 * @param {Number} direction: 1 for forward, -1 for backward
 */
function calculateTargetIndex(startIndex, direction) {
    const widthBuffer = 5;
    let containerWidth = this.containerWidth + widthBuffer + constants.margin; // add margin to compensate for last item not having margin
    let increment = 0;
    let index = startIndex;

    while (containerWidth > 0) {
        if (index > this.state.totalItems || index < 0) {
            break;
        }
        containerWidth -= this.getItemWidth(index);
        increment += 1;
        index += direction;
        containerWidth -= constants.margin;
    }

    return increment - 1;
}

/**
 * Get the offset that the carousel needs to push forward by based on index
 */
function getOffset(widthBeforeIndex, startIndex, endIndex) {
    let offset = 0;
    const widthToEnd = this.getWidthBeforeIndex(endIndex) - constants.margin - constants.margin;

    if (endIndex > this.state.totalItems && startIndex < this.state.totalItems) {
        offset = this.containerWidth - (widthToEnd - widthBeforeIndex);
    }

    return offset;
}

/**
 * Get the aggregate width of all items in the carousel until this index
 */
function getWidthBeforeIndex(index = 0) {
    let width = 0;

    for (let i = 0; i < index; i++) {
        width += this.getItemWidth(i) + constants.margin;
    }

    return width;
}

/**
 * Calculate and store widths of container and items
 * @params {Boolean} forceUpdate: Updates the cache with new values
 */
function calculateWidths(forceUpdate) {
    this.containerWidth = this.getContainerWidth();
    for (let i = 0; i < this.state.totalItems; i++) {
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
    } else if (index < this.state.totalItems && index >= 0) {
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
    bindEventListeners,
    handleNext,
    handlePrev,
    performSlide,
    updateControls,
    calculateTargetIndex,
    moveToIndex,
    getOffset,
    getWidthBeforeIndex,
    calculateWidths,
    getItemWidth,
    getContainerWidth
});

module.exports.privates = { constants, defaults };
