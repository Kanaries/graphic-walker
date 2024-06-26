import { getShowIndices } from './pagination';

describe('getShowIndices', () => {
    const pageSize = 50;
    const extendPageNumber = 1;
    test('totalpage 1', () => {
        expect(getShowIndices(25, 0, pageSize, extendPageNumber)).toEqual([{ index: 0, disabled: false, type: 'page' }]);
    });
    test('totalpage 2', () => {
        expect(getShowIndices(100, 0, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 3', () => {
        expect(getShowIndices(150, 0, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: 2, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 4', () => {
        expect(getShowIndices(200, 0, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 3, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 5', () => {
        expect(getShowIndices(250, 0, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 4, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 300', () => {
        expect(getShowIndices(15000, 0, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 299, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 300 pageIndex 150', () => {
        expect(getShowIndices(15000, 150, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 149, disabled: false, type: 'page' },
            { index: 150, disabled: false, type: 'page' },
            { index: 151, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 299, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 2 pageIndex 1', () => {
        expect(getShowIndices(100, 1, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 3 pageIndex 1', () => {
        expect(getShowIndices(150, 1, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: 2, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 4 pageIndex 1', () => {
        expect(getShowIndices(200, 1, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: 2, disabled: false, type: 'page' },
            { index: 3, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 5 pageIndex 1', () => {
        expect(getShowIndices(250, 1, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: 2, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 4, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 5 pageIndex 2', () => {
        expect(getShowIndices(250, 2, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: 1, disabled: false, type: 'page' },
            { index: 2, disabled: false, type: 'page' },
            { index: 3, disabled: false, type: 'page' },
            { index: 4, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 5 pageIndex 3', () => {
        expect(getShowIndices(250, 3, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 2, disabled: false, type: 'page' },
            { index: 3, disabled: false, type: 'page' },
            { index: 4, disabled: false, type: 'page' },
        ]);
    });
    test('totalpage 5 pageIndex 4', () => {
        expect(getShowIndices(250, 4, pageSize, extendPageNumber)).toEqual([
            { index: 0, disabled: false, type: 'page' },
            { index: -1, type: 'placeholder' },
            { index: 3, disabled: false, type: 'page' },
            { index: 4, disabled: false, type: 'page' },
        ]);
    });
});
