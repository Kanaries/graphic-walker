import type { IMutField } from '../../interfaces';
import { getHeaders } from './headers';

const field = (...path: string[]): IMutField => ({
    fid: path.join('.'),
    name: path.join('.'),
    basename: path[path.length - 1],
    path,
    semanticType: 'nominal',
    analyticType: 'dimension',
});

const summarize = (metas: IMutField[]) =>
    getHeaders(metas).map((row) => row.map((x) => (x.type === 'name' ? `[${x.value}]x${x.colSpan}` : `${x.value.fid}/${x.rowSpan}`)));

describe('getHeaders', () => {
    test('flat fields share one header row', () => {
        expect(summarize([field('a'), field('b')])).toEqual([['a/1', 'b/1']]);
    });

    test('adjacent groups at the same depth stay separate', () => {
        expect(summarize([field('student'), field('scores', 'math'), field('scores', 'reading'), field('meta', 'lunch'), field('meta', 'prep')])).toEqual([
            ['student/2', '[scores]x2', '[meta]x2'],
            ['scores.math/1', 'scores.reading/1', 'meta.lunch/1', 'meta.prep/1'],
        ]);
    });

    test('a group interrupted by another field is opened again', () => {
        expect(summarize([field('a', 'x'), field('b'), field('a', 'y')])).toEqual([
            ['[a]x1', 'b/2', '[a]x1'],
            ['a.x/1', 'a.y/1'],
        ]);
    });

    test('nested groups only merge under the same parent', () => {
        expect(summarize([field('a', 'b', 'x'), field('a', 'b', 'y'), field('a', 'c', 'z'), field('d', 'c', 'w')])).toEqual([
            ['[a]x3', '[d]x1'],
            ['[b]x2', '[c]x1', '[c]x1'],
            ['a.b.x/1', 'a.b.y/1', 'a.c.z/1', 'd.c.w/1'],
        ]);
    });
});
