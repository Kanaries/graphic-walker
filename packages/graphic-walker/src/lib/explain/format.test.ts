import { categoryLabel, formatBinRange, formatMeasureValue } from './format';

describe('formatMeasureValue', () => {
    it('never leaks float noise', () => {
        expect(formatMeasureValue(11.399379999999999)).toBe('11.4');
        expect(formatMeasureValue(0.30000000000000004)).toBe('0.3');
    });
    it('scales precision with magnitude', () => {
        expect(formatMeasureValue(285014.6)).toBe('285015');
        expect(formatMeasureValue(302.44)).toBe('302.4');
        expect(formatMeasureValue(59.5)).toBe('59.5');
        expect(formatMeasureValue(0.0123456)).toBe('0.0123');
        expect(formatMeasureValue(0)).toBe('0');
        expect(formatMeasureValue(-1234.9)).toBe('-1235');
    });
    it('stays Number()-parseable (description params get re-parsed in tests)', () => {
        for (const v of [285014.6, 302.44, 59.5, -0.5, 1e-4]) {
            expect(Number.isFinite(Number(formatMeasureValue(v)))).toBe(true);
        }
    });
});

describe('formatBinRange', () => {
    it('fixes the reported bin-label regression', () => {
        expect(formatBinRange(11.399379999999999, 17.099069999999998)).toBe('11.4–17.1');
        expect(formatBinRange(15.970000000000002, 20.576)).toBe('16–20.6');
    });
    it('adapts decimals to bin width', () => {
        expect(formatBinRange(0, 1000)).toBe('0–1000');
        expect(formatBinRange(0.02, 0.08)).toBe('0.02–0.08');
    });
});

describe('categoryLabel', () => {
    it('formats bin tuples and passes strings through', () => {
        expect(categoryLabel([11.399379999999999, 17.099069999999998])).toBe('11.4–17.1');
        expect(categoryLabel('online')).toBe('online');
        expect(categoryLabel(42.00000000001)).toBe('42');
    });
});
