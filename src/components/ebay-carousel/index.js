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
        totalItems: items.length,
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
    this.subscribeTo(window).on('resize', throttle(() => this.resizeHandler(), 100));
    this.calculateWidths();
    this.performSlide();
}

function resizeHandler() {
    this.calculateWidths(true);
    this.performSlide();
}

function update_index() { // eslint-disable-line camelcase
    this.performSlide();
}

function handleNext() {
    if (!this.state.nextControlDisabled) {
        this.setState('index', this.calculateNextIndex());
        emitAndFire(this, 'carousel-next');
    }
}

function handlePrev() {
    if (!this.state.prevControlDisabled) {
        this.setState('index', this.calculatePrevIndex());
        emitAndFire(this, 'carousel-prev');
    }
}

/**
 * High level slide called for initialization and data change to index (via UI and API)
 * @param {Integer} index
 */
function performSlide() {
    if (this.state.index >= 0 && this.state.index <= this.lastIndex) {
        this.moveToIndex(this.state.index);
        this.setState('firstVisibleIndex', this.calculateFirstVisibleIndex());
        this.setState('lastVisibleIndex', this.calculateLastVisibleIndex());
        this.setState('prevControlDisabled', this.state.index === 0);
        this.setState('nextControlDisabled', this.state.lastVisibleIndex === this.lastIndex);
    }

    this.update(); // FIXME: why won't it rerender on its own?

    // update directly nested child links via DOM (we don't control this content)
    const hiddenLinks = this.el.querySelectorAll('.carousel__list > li[aria-hidden="true"] > a');
    const visibleLinks = this.el.querySelectorAll('.carousel__list > li[aria-hidden="false"] > a');
    (hiddenLinks || []).forEach(link => link.setAttribute('tabindex', '-1'));
    (visibleLinks || []).forEach(link => link.removeAttribute('tabindex'));
}

/**
 * Move carousel position to an index
 * @param {Integer} index
 */
function moveToIndex(index) {
    let translation = -1 * this.getWidthBeforeIndex(index);
    const maxTranslation = -1 * (this.allItemsWidth - this.containerWidth);
    if (translation !== 0 && translation < maxTranslation) {
        translation = maxTranslation;
    }
    if (translation !== this.state.translation) {
        this.setState('translation', translation);
        emitAndFire(this, 'carousel-translate');
    }
}

function calculateNextIndex() {
    return this.calculateLastVisibleIndex() + 1;
}

function calculatePrevIndex() {
    let index = this.state.index - 1;

    if (this.state.isDiscrete) {
        return index;
    }

    // check if we'll hit the left end
    const widthBeforeCurrentIndex = this.getWidthBeforeIndex(this.state.index);
    if (widthBeforeCurrentIndex < this.containerWidth) {
        return 0;
    }

    if (this.state.nextControlDisabled) {
        index = this.calculateFirstVisibleIndex() - 1;
    }

    return this.widthLoop(index, -1) + 1;
}

function widthLoop(startIndex, direction) {
    let index = startIndex;
    let remainingWidth = this.containerWidth;

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
    if (this.state.isDiscrete || !this.state.nextControlDisabled) {
        return this.state.index;
    }

    // if continuous carousel is all the way on right side, need to calculate manually
    return this.widthLoop(this.lastIndex, -1) + 1;
}

function calculateLastVisibleIndex() {
    if (this.state.isDiscrete) {
        return this.state.index;
    }

    return this.widthLoop(this.state.index, 1) - 1;
}

/**
 * Get the aggregate width of all items in the carousel until this index
 * @params {Integer} index
 */
function getWidthBeforeIndex(index) {
    let width = 0;
    for (let i = 0; i < index; i++) {
        width += this.getItemWidth(i) + constants.margin;
    }

    return width;
}

/**
 * Get the aggregate width of all items in the carousel after (and including) this index
 * @params {Integer} index
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
    this.allItemsWidth = this.getWidthAfterIndex(0);
    this.containerWidth = this.listEl.getBoundingClientRect().width;
    for (let i = 0; i <= this.lastIndex; i++) {
        this.getItemWidth(i, forceUpdate);
    }
}

/**
 * Get single item width based on index
 * @params {Integer} index: Index of the carousel item
 * @params {Boolean} forceUpdate: Trigger fetch update of cache values
 */
function getItemWidth(index, forceUpdate) {
    if (this.itemCache && this.itemCache[index] && !forceUpdate) {
        return this.itemCache[index];
    } else if (index >= 0 && index <= this.lastIndex) {
        this.itemCache[index] = this.itemEls[index].getBoundingClientRect().width;
        return this.itemCache[index];
    }

    return 0;
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
    calculateNextIndex,
    calculatePrevIndex,
    moveToIndex,
    widthLoop,
    calculateFirstVisibleIndex,
    calculateLastVisibleIndex,
    getWidthBeforeIndex,
    getWidthAfterIndex,
    calculateWidths,
    getItemWidth
});

module.exports.privates = { constants, defaults };
