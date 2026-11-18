import type { Feature } from 'geojson';
import { featureKeyValue, listFeatureKeys, matchFeatures, normalizeGeoValue, suggestFeatureKey } from './matching';

const shape = (properties: Record<string, unknown> | null, id?: string | number): Feature => ({
    type: 'Feature',
    ...(id === undefined ? {} : { id }),
    properties,
    geometry: { type: 'Point', coordinates: [0, 0] },
});

describe('normalizeGeoValue', () => {
    it('ignores case, surrounding and repeated spaces, and full-width forms', () => {
        expect(normalizeGeoValue('  New   York ')).toBe('new york');
        expect(normalizeGeoValue('ＮＥＷ　ＹＯＲＫ')).toBe('new york');
        expect(normalizeGeoValue('ﾄｳｷｮｳ')).toBe(normalizeGeoValue('トウキョウ'));
    });
    it('reads numbers as their text and has nothing for null, objects and blanks', () => {
        expect(normalizeGeoValue(6)).toBe('6');
        expect(normalizeGeoValue(null)).toBe('');
        expect(normalizeGeoValue(undefined)).toBe('');
        expect(normalizeGeoValue({})).toBe('');
        expect(normalizeGeoValue('   ')).toBe('');
        expect(normalizeGeoValue(NaN)).toBe('');
    });
});

describe('featureKeyValue', () => {
    it('reads properties first and falls back to the feature id for the key "id"', () => {
        expect(featureKeyValue(shape({ name: 'Japan' }, 'JPN'), 'name')).toBe('Japan');
        expect(featureKeyValue(shape({ name: 'Japan' }, 'JPN'), 'id')).toBe('JPN');
        expect(featureKeyValue(shape({ id: 'inner' }, 'outer'), 'id')).toBe('inner');
        expect(featureKeyValue(shape(null, 392), 'id')).toBe(392);
        expect(featureKeyValue(shape({ name: 'Japan' }, 'JPN'), 'iso')).toBeUndefined();
    });
});

describe('matchFeatures', () => {
    const features = [shape({ name: 'United States of America', code: 840 }, 'USA'), shape({ name: 'Japan', code: 392 }, 'JPN'), shape({ name: 'South Korea', code: 410 }, 'KOR')];

    it('joins numbers to text and text to numbers', () => {
        expect(matchFeatures(['392', 410], features, 'code').rowFeatures).toEqual([[1], [2]]);
        const numericIds = [shape({}, 1), shape({}, 2)];
        expect(matchFeatures(['2', 1], numericIds, 'id').rowFeatures).toEqual([[1], [0]]);
    });

    it('joins on the feature id, where world files keep their ISO code', () => {
        const match = matchFeatures(['JPN', 'usa', ' KOR '], features, 'id');
        expect(match.rowFeatures).toEqual([[1], [0], [2]]);
        expect(match.matchedRows).toEqual([0, 1, 2]);
        expect(match.unmatchedRows).toBe(0);
    });

    it('ignores case and spacing, and prefers the value as written when the file tells them apart', () => {
        expect(matchFeatures(['  japan', 'SOUTH  KOREA'], features, 'name').rowFeatures).toEqual([[1], [2]]);
        const twins = [shape({ k: 'al' }), shape({ k: 'AL' })];
        expect(matchFeatures(['AL', 'al', 'Al'], twins, 'k').rowFeatures).toEqual([[1], [0], [0, 1]]);
    });

    it('reports what did not match, each value once and in order', () => {
        const match = matchFeatures(['East', 'Japan', 'West', 'East', null, '', '  '], features, 'name');
        expect(match.matchedRows).toEqual([1]);
        expect(match.unmatchedRows).toBe(3);
        expect(match.unmatchedValues).toEqual(['East', 'West']);
        expect(match.emptyRows).toBe(3);
        expect(match.distinctValues).toBe(3);
        expect(match.unusedFeatures).toEqual([0, 2]);
        expect(match.featureSamples).toEqual(['United States of America', 'Japan', 'South Korea']);
    });

    it('says when no feature has the key at all', () => {
        const match = matchFeatures(['Japan'], features, 'iso_a3');
        expect(match.keyedFeatures).toBe(0);
        expect(match.matchedRows).toEqual([]);
        expect(match.unusedFeatures).toEqual([0, 1, 2]);
        expect(matchFeatures(['Japan'], features, '').keyedFeatures).toBe(0);
    });

    it('gives a row every feature that shares its key', () => {
        const islands = [shape({ name: 'Japan' }), shape({ name: 'Korea' }), shape({ name: 'Japan' })];
        const match = matchFeatures(['Japan'], islands, 'name');
        expect(match.rowFeatures).toEqual([[0, 2]]);
        expect(match.unusedFeatures).toEqual([1]);
    });

    it('treats 0 as a value and skips features without properties', () => {
        const zero = [shape({ code: 0 }), shape(null)];
        const match = matchFeatures([0, '0'], zero, 'code');
        expect(match.rowFeatures).toEqual([[0], [0]]);
        expect(match.keyedFeatures).toBe(1);
    });

    it('reports values that are written differently and reach the same feature', () => {
        const squares = [shape({ name: 'EAST' }), shape({ name: 'Westland' })];
        const match = matchFeatures(['East', 'EAST', 'east', 'EAST', 'West'], squares, 'name');
        // The rows stay apart: adding them up is for the aggregation, which knows the measure.
        expect(match.rowFeatures).toEqual([[0], [0], [0], [0], []]);
        expect(match.sharedValues).toEqual([['East', 'EAST', 'east']]);
        expect(match.distinctValues).toBe(4);
        expect(match.unmatchedValues).toEqual(['West']);
    });

    it('does not report one value that reaches several features, or several rows of one value', () => {
        const islands = [shape({ name: 'Japan' }), shape({ name: 'Japan' }), shape({ name: 'Korea' })];
        expect(matchFeatures(['Japan', 'Japan', 'Korea'], islands, 'name').sharedValues).toEqual([]);
        // Two spellings that reach the same two features are one group, not one per feature.
        expect(matchFeatures(['Japan', 'JAPAN'], islands, 'name').sharedValues).toEqual([['Japan', 'JAPAN']]);
    });

    it('skips an entry that is not a feature', () => {
        const broken = [null, shape({ name: 'Japan' })] as unknown as Feature[];
        expect(matchFeatures(['Japan'], broken, 'name').rowFeatures).toEqual([[1]]);
        expect(listFeatureKeys(broken)).toEqual([{ key: 'name', samples: ['Japan'], count: 1 }]);
    });

    it('looks values up in a table, so many rows against many features stay fast', () => {
        const many = Array.from({ length: 5000 }, (_, i) => shape({ name: `Region ${i}` }));
        const values = Array.from({ length: 100000 }, (_, i) => `region ${i % 6000}`);
        const start = Date.now();
        const match = matchFeatures(values, many, 'name');
        // A scan of every feature for every row is 500 million comparisons and takes many seconds.
        expect(Date.now() - start).toBeLessThan(2000);
        expect(match.matchedRows.length).toBeGreaterThan(80000);
        expect(match.unmatchedValues).toHaveLength(1000);
    });
});

describe('listFeatureKeys', () => {
    const features = [shape({ name: 'Japan', pop: 125, tags: ['a'] }, 'JPN'), shape({ name: 'Japan', iso: 'KR' }, 'KOR'), shape({ name: 'USA', note: null }, 'USA'), shape({ name: 'Peru' })];

    it('lists the properties that hold text or numbers, with samples, and the feature id', () => {
        expect(listFeatureKeys(features)).toEqual([
            { key: 'name', samples: ['Japan', 'USA', 'Peru'], count: 4 },
            { key: 'pop', samples: ['125'], count: 1 },
            { key: 'id', samples: ['JPN', 'KOR', 'USA'], count: 3 },
            { key: 'iso', samples: ['KR'], count: 1 },
        ]);
    });

    it('does not list the feature id a second time when a property is called id', () => {
        expect(listFeatureKeys([shape({ id: 'inner' }, 'outer')])).toEqual([{ key: 'id', samples: ['inner'], count: 1 }]);
    });

    it('offers the feature id when the property called id is empty, as matching reads it', () => {
        const world = [shape({ id: null, name: 'United States' }, 'USA'), shape({ id: null, name: 'Japan' }, 'JPN')];
        expect(listFeatureKeys(world)).toEqual([
            { key: 'id', samples: ['USA', 'JPN'], count: 2 },
            { key: 'name', samples: ['United States', 'Japan'], count: 2 },
        ]);
        expect(suggestFeatureKey(listFeatureKeys(world), 'id')).toBe('id');
        expect(matchFeatures(['USA'], world, 'id').rowFeatures).toEqual([[0]]);
    });

    it('suggests the current key when the file has it, else name, else the first', () => {
        const keys = listFeatureKeys(features);
        expect(suggestFeatureKey(keys, 'iso')).toBe('iso');
        expect(suggestFeatureKey(keys, 'missing')).toBe('name');
        expect(suggestFeatureKey(listFeatureKeys([shape({ NAME: 'x', code: 1 })]), '')).toBe('NAME');
        expect(suggestFeatureKey(listFeatureKeys([shape({ code: 1 })]), 'name')).toBe('code');
        expect(suggestFeatureKey([], 'name')).toBe('');
    });
});
