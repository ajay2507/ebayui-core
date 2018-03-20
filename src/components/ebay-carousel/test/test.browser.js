const sinon = require('sinon');
const expect = require('chai').expect;
const testUtils = require('../../../common/test-utils/browser');
const mock = require('../mock');
const renderer = require('../');

const privates = renderer.privates;
const constants = privates.constants;
const defaults = privates.defaults;
const containerWidth = 800; // puppeteer default

describe('given the carousel is in the default state', () => {
    let widget;
    let root;

    beforeEach(() => {
        widget = renderer.renderSync().appendTo(document.body).getWidget();
        root = document.querySelector('.carousel');
    });
    afterEach(() => widget.destroy());

    describe('when it is rendered', () => {
        it('then it sets state to correct defaults', () => {
            expect(widget.state.type).to.equal(defaults.type);
        });

        it('then it exposes state on root element', () => {
            expect(root.index).to.equal(0);
        });
    });

    describe('when the window is resized', () => {
        let spy;
        beforeEach((done) => {
            spy = sinon.spy(widget, 'resizeHandler');
            testUtils.triggerEvent(window, 'resize');
            setTimeout(done, 100);
        });
        afterEach(() => widget.resizeHandler.restore());

        it('then it executes the resize handler', () => {
            expect(spy.calledOnce).to.equal(true);
        });
    });
});

describe('given the carousel starts in the default state', () => {
    const input = { items: mock.sixItems };
    let widget;
    let root;
    let list;
    let prevButton;
    let nextButton;

    beforeEach((done) => {
        widget = renderer.renderSync(input).appendTo(document.body).getWidget();
        root = document.querySelector('.carousel');
        list = root.querySelector('.carousel__list');
        nextButton = root.querySelector('.carousel__control--next');
        prevButton = root.querySelector('.carousel__control--prev');
        setTimeout(done);
    });
    afterEach(() => widget.destroy());

    describe('when index is updated programmatically', () => {
        let spy;
        beforeEach((done) => {
            spy = sinon.spy();
            widget.on('carousel-translate', spy);
            root.index = 1;
            setTimeout(done);
        });

        it('then it emits the marko event', () => {
            expect(spy.calledOnce).to.equal(true);
        });

        it('then it applies a translation', () => {
            const translation = mock.itemWidth + constants.margin;
            expect(list.style.transform).to.equal(`translateX(-${translation}px)`);
        });
    });

    describe('when the previous button is clicked while disabled', () => {
        let prevSpy;
        beforeEach((done) => {
            prevSpy = sinon.spy();
            widget.on('carousel-prev', prevSpy);
            testUtils.triggerEvent(prevButton, 'click');
            setTimeout(done);
        });

        it('then it does not emits the marko prev event', () => {
            expect(prevSpy.called).to.equal(false);
        });
    });

    describe('when next button is clicked', () => {
        let nextSpy;
        let translateSpy;
        beforeEach((done) => {
            nextSpy = sinon.spy();
            translateSpy = sinon.spy();
            widget.on('carousel-next', nextSpy);
            widget.on('carousel-translate', translateSpy);
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(done);
        });

        it('then it emits the marko next event', () => {
            expect(nextSpy.calledOnce).to.equal(true);
        });

        it('then it emits the marko translate event', () => {
            expect(translateSpy.calledOnce).to.equal(true);
        });

        it('then it applies a translation', () => {
            expect(list.style.transform).to.equal('translateX(-480px)');
        });
    });

    describe('when index is set below zero', () => {
        let spy;
        beforeEach(() => {
            spy = sinon.spy();
            widget.on('carousel-translate', spy);
            widget.update_index(-1);
        });

        it('then it does not emit the marko translate event', () => {
            expect(spy.called).to.equal(false);
        });
    });

    describe('when index is set above the number of items', () => {
        let spy;
        beforeEach(() => {
            spy = sinon.spy();
            widget.on('carousel-translate', spy);
            widget.update_index(99);
        });

        it('then it does not emit the marko translate event', () => {
            expect(spy.called).to.equal(false);
        });
    });
});

describe('given a continuous carousel has next button clicked', () => {
    const input = { items: mock.sixItems };
    let widget;
    let root;
    let list;
    let nextButton;
    let prevButton;

    beforeEach((done) => {
        widget = renderer.renderSync(input).appendTo(document.body).getWidget();
        root = document.querySelector('.carousel');
        list = root.querySelector('.carousel__list');
        nextButton = root.querySelector('.carousel__control--next');
        prevButton = root.querySelector('.carousel__control--prev');
        setTimeout(() => {
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(() => {
                expect(list.style.transform).to.equal('translateX(-480px)');
                done();
            });
        });
    });
    afterEach(() => widget.destroy());

    describe('when the previous button is clicked', () => {
        let prevSpy;
        let translateSpy;
        beforeEach((done) => {
            prevSpy = sinon.spy();
            translateSpy = sinon.spy();
            widget.on('carousel-prev', prevSpy);
            widget.on('carousel-translate', translateSpy);
            testUtils.triggerEvent(prevButton, 'click');
            setTimeout(done);
        });

        it('then it emits the marko prev event', () => {
            expect(prevSpy.calledOnce).to.equal(true);
        });

        it('then it emits the marko translate event', () => {
            expect(translateSpy.calledOnce).to.equal(true);
        });

        it('then it applies a translation back to 0', () => {
            expect(list.style.transform).to.equal('translateX(0px)');
        });
    });

    describe('when the next button is clicked while disabled', () => {
        let nextSpy;
        beforeEach((done) => {
            nextSpy = sinon.spy();
            widget.on('carousel-next', nextSpy);
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(done);
        });

        it('then it does not emits the marko next event', () => {
            expect(nextSpy.called).to.equal(false);
        });
    });
});

describe('given a continuous carousel with few items', () => {
    const input = { items: mock.threeItems };
    let widget;
    let list;

    beforeEach((done) => {
        widget = renderer.renderSync(input).appendTo(document.body).getWidget();
        list = document.querySelector('.carousel__list');
        setTimeout(done);
    });
    afterEach(() => widget.destroy());

    describe('when index is set', () => {
        let spy;
        beforeEach(() => {
            expect(list.style.transform).to.equal(`translateX(0px)`);
            spy = sinon.spy();
            widget.on('carousel-translate', spy);
            widget.update_index(1);
        });

        it('then it does not emit the marko translate event', () => {
            expect(spy.called).to.equal(false);
        });
    });
});

describe('given a continuous carousel with many items', () => {
    const input = { items: mock.twelveItems };
    let widget;
    let root;
    let prevButton;
    let nextButton;

    beforeEach((done) => {
        widget = renderer.renderSync(input).appendTo(document.body).getWidget();
        root = document.querySelector('.carousel');
        prevButton = root.querySelector('.carousel__control--prev');
        nextButton = root.querySelector('.carousel__control--next');
        setTimeout(done);
    });
    afterEach(() => widget.destroy());

    describe('when next button is clicked three times', () => {
        let nextSpy;
        let translateSpy;
        beforeEach((done) => {
            nextSpy = sinon.spy();
            translateSpy = sinon.spy();
            widget.on('carousel-next', nextSpy);
            widget.on('carousel-translate', translateSpy);
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(() => {
                testUtils.triggerEvent(nextButton, 'click');
                setTimeout(() => {
                    testUtils.triggerEvent(nextButton, 'click');
                    setTimeout(done);
                });
            });
        });

        it('then it emits the marko events', () => {
            expect(nextSpy.callCount).to.equal(3);
            expect(translateSpy.callCount).to.equal(3);
        });

        it('then the last item is visible', () => {
            expect(widget.state.lastVisibleIndex).to.equal(mock.twelveItems.length - 1);
        });
    });

    describe('when next button is clicked three times, and previous button is clicked once', () => {
        let prevSpy;
        let nextSpy;
        let translateSpy;
        beforeEach((done) => {
            prevSpy = sinon.spy();
            nextSpy = sinon.spy();
            translateSpy = sinon.spy();
            widget.on('carousel-prev', prevSpy);
            widget.on('carousel-next', nextSpy);
            widget.on('carousel-translate', translateSpy);
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(() => {
                testUtils.triggerEvent(nextButton, 'click');
                setTimeout(() => {
                    testUtils.triggerEvent(nextButton, 'click');
                    setTimeout(() => {
                        testUtils.triggerEvent(prevButton, 'click');
                        setTimeout(done);
                    });
                });
            });
        });

        it('then it emits the marko events', () => {
            expect(prevSpy.callCount).to.equal(1);
            expect(nextSpy.callCount).to.equal(3);
            expect(translateSpy.callCount).to.equal(4);
        });

        it('then it moves to the correct index', () => {
            expect(root.index).to.equal(6);
        });
    });

    describe('when next button is clicked twice, and previous button is clicked once', () => {
        let prevSpy;
        let nextSpy;
        let translateSpy;
        beforeEach((done) => {
            prevSpy = sinon.spy();
            nextSpy = sinon.spy();
            translateSpy = sinon.spy();
            widget.on('carousel-prev', prevSpy);
            widget.on('carousel-next', nextSpy);
            widget.on('carousel-translate', translateSpy);
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(() => {
                testUtils.triggerEvent(nextButton, 'click');
                setTimeout(() => {
                    testUtils.triggerEvent(prevButton, 'click');
                    setTimeout(done);
                });
            });
        });

        it('then it emits the marko events', () => {
            expect(prevSpy.callCount).to.equal(1);
            expect(nextSpy.callCount).to.equal(2);
            expect(translateSpy.callCount).to.equal(3);
        });

        it('then it moves to the correct index', () => {
            expect(root.index).to.equal(3);
        });
    });
});

describe('given a discrete carousel', () => {
    const input = { type: 'discrete', items: mock.threeItems };
    let widget;
    let root;
    let list;
    let nextButton;

    beforeEach((done) => {
        widget = renderer.renderSync(input).appendTo(document.body).getWidget();
        root = document.querySelector('.carousel');
        list = root.querySelector('.carousel__list');
        nextButton = root.querySelector('.carousel__control--next');
        setTimeout(done);
    });
    afterEach(() => widget.destroy());

    describe('when next button is clicked', () => {
        let nextSpy;
        let translateSpy;
        beforeEach((done) => {
            nextSpy = sinon.spy();
            translateSpy = sinon.spy();
            widget.on('carousel-next', nextSpy);
            widget.on('carousel-translate', translateSpy);
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(done);
        });

        it('then it emits the marko next event', () => {
            expect(nextSpy.calledOnce).to.equal(true);
        });

        it('then it emits the marko translate event', () => {
            expect(translateSpy.calledOnce).to.equal(true);
        });

        it('then it applies a translation', () => {
            expect(list.style.transform).to.equal(`translateX(-${containerWidth + constants.margin}px)`);
        });
    });
});

describe('given a discrete carousel has next button clicked', () => {
    const input = { type: 'discrete', items: mock.threeItems };
    let widget;
    let root;
    let list;
    let nextButton;
    let prevButton;

    beforeEach((done) => {
        widget = renderer.renderSync(input).appendTo(document.body).getWidget();
        root = document.querySelector('.carousel');
        list = root.querySelector('.carousel__list');
        nextButton = root.querySelector('.carousel__control--next');
        prevButton = root.querySelector('.carousel__control--prev');
        setTimeout(() => {
            testUtils.triggerEvent(nextButton, 'click');
            setTimeout(() => {
                expect(list.style.transform).to.equal(`translateX(-${containerWidth + constants.margin}px)`);
                done();
            });
        });
    });
    afterEach(() => widget.destroy());

    describe('when the previous button is clicked', () => {
        let prevSpy;
        let translateSpy;
        beforeEach((done) => {
            prevSpy = sinon.spy();
            translateSpy = sinon.spy();
            widget.on('carousel-prev', prevSpy);
            widget.on('carousel-translate', translateSpy);
            testUtils.triggerEvent(prevButton, 'click');
            setTimeout(done);
        });

        it('then it emits the marko prev event', () => {
            expect(prevSpy.calledOnce).to.equal(true);
        });

        it('then it emits the marko translate event', () => {
            expect(translateSpy.calledOnce).to.equal(true);
        });

        it('then it applies a translation back to 0', () => {
            expect(list.style.transform).to.equal('translateX(0px)');
        });
    });
});
