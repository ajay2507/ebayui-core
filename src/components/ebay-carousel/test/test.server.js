const expect = require('chai').expect;
const testUtils = require('../../../common/test-utils/server');
const mock = require('../mock');

describe('carosuel', () => {
    test('renders basic version', context => {
        const input = { items: mock.sixItems };
        const $ = testUtils.getCheerio(context.render(input));
        expect($('.carousel.carousel--continuous').length).to.equal(1);
        expect($('.carousel__control--prev').length).to.equal(1);
        expect($('.carousel__control--next').length).to.equal(1);
        expect($('ul.carousel__list').length).to.equal(1);
        expect($('ul.carousel__list > li').length).to.equal(mock.sixItems.length);
        expect($('ul.carousel__list > li:first-of-type[aria-hidden=false]').length).to.equal(1);
    });

    test('handles pass-through html attributes', context => {
        testUtils.testHtmlAttributes(context, '.carousel');
    });

    test('handles custom class', context => {
        testUtils.testCustomClass(context, '.carousel');
    });
});

describe('carousel-item', () => {
    test('handles pass-through html attributes', context => {
        testUtils.testHtmlAttributes(context, '.carousel__list > li', 'items');
    });

    test('handles custom class', context => {
        testUtils.testCustomClass(context, '.carousel__list > li', 'items', true);
    });
});
