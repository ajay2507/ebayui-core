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
    this.calculateWidths();
    this.performSlide(this.state.index);
    this.subscribeTo(window).on('resize', throttle(() => this.resizeHandler(), 100));
}

function resizeHandler() {
    this.calculateWidths(true);
    this.performSlide(parseInt(this.state.index));
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

function update_index(newIndex) { // eslint-disable-line camelcase
    this.performSlide(parseInt(newIndex));
}

/**
 * Highest level slide function called from any data change to index (via UI and API)
 * @param {Integer} index
 */
function performSlide(index) {
    if (index >= 0 && index <= this.lastIndex) {
        this.moveToIndex(index);
        this.setState('prevControlDisabled', this.state.index === 0);
        this.setState('nextControlDisabled', this.state.stop || this.state.index === this.lastIndex);
    }

    this.setState('firstVisibleIndex', this.calculateFirstVisibleIndex());
    this.setState('lastVisibleIndex', this.calculateLastVisibleIndex());

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
    }
}

function calculateNextIndex() {
    if (this.state.isDiscrete) {
        return this.state.index + 1;
    }

    const lastVisibleIndex = this.calculateLastVisibleIndex();
    let index = lastVisibleIndex + 1;

    // if we'll hit the right end, target index should be current lastVisibleIndex
    if (this.getWidthAfterIndex(lastVisibleIndex) < this.containerWidth) {
        index = lastVisibleIndex;
    }

    return index;
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
    if (!this.state.nextControlDisabled) {
        return this.state.index;
    }

    // if carousel is all the way on right side, need to calculate manually
    return this.widthLoop(this.lastIndex, -1) + 1;
}

function calculateLastVisibleIndex() {
    return this.widthLoop(this.state.index, 1) - 1;
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
    this.allItemsWidth = this.getWidthBeforeIndex(this.lastIndex + 1);
    this.containerWidth = this.listEl.getBoundingClientRect().width || 0;
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
        const rect = this.itemEls[index].getBoundingClientRect();
        this.itemCache[index] = rect.width || 0;
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
