import type { Geometry } from 'geojson';
import { WORLD_BOUNDS, extendBounds, resolveParts, ringCentroid, type LatLng } from './geometry';

// GeoJSON writes [lng, lat]. A 10 by 10 square with a 2 by 2 hole in the middle.
const outline = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole = [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]];
const flip = (ring: number[][]) => ring.map(([lng, lat]) => [lat, lng]);

describe('resolveParts', () => {
    it('keeps the holes of a polygon and turns [lng, lat] into [lat, lng]', () => {
        const parts = resolveParts({ type: 'Polygon', coordinates: [outline, hole] });
        expect(parts).toEqual([{ type: 'polygon', rings: [flip(outline), flip(hole)] }]);
    });

    it('keeps the holes of every part of a multipolygon', () => {
        const island = [[20, 20], [21, 20], [21, 21], [20, 20]];
        const parts = resolveParts({ type: 'MultiPolygon', coordinates: [[outline, hole], [island]] });
        expect(parts).toEqual([
            { type: 'polygon', rings: [flip(outline), flip(hole)] },
            { type: 'polygon', rings: [flip(island)] },
        ]);
    });

    it('draws points as points and lines as lines, never as filled areas', () => {
        expect(resolveParts({ type: 'Point', coordinates: [139.7, 35.7] })).toEqual([{ type: 'point', position: [35.7, 139.7] }]);
        expect(resolveParts({ type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] })).toEqual([
            { type: 'point', position: [2, 1] },
            { type: 'point', position: [4, 3] },
        ]);
        expect(resolveParts({ type: 'LineString', coordinates: [[1, 2], [3, 4]] })).toEqual([{ type: 'line', positions: [[2, 1], [4, 3]] }]);
        expect(resolveParts({ type: 'MultiLineString', coordinates: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]] })).toHaveLength(2);
    });

    it('flattens a geometry collection', () => {
        const collection: Geometry = {
            type: 'GeometryCollection',
            geometries: [
                { type: 'Point', coordinates: [1, 2] },
                { type: 'Polygon', coordinates: [outline] },
            ],
        };
        expect(resolveParts(collection).map((p) => p.type)).toEqual(['point', 'polygon']);
    });

    it('returns nothing for a feature without geometry or with a broken one', () => {
        expect(resolveParts(null)).toEqual([]);
        expect(resolveParts(undefined)).toEqual([]);
        expect(resolveParts({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] })).toEqual([]);
        expect(resolveParts({ type: 'Polygon', coordinates: [] })).toEqual([]);
        expect(resolveParts({ type: 'Point', coordinates: [] })).toEqual([]);
        // A hole too short to be a ring is dropped. The outline stays.
        expect(resolveParts({ type: 'Polygon', coordinates: [outline, [[1, 1], [2, 2]]] })).toEqual([{ type: 'polygon', rings: [flip(outline)] }]);
    });
});

describe('resolveParts on files that break the format', () => {
    it('returns nothing where coordinates or member geometries are missing', () => {
        const broken = (geometry: object) => resolveParts(geometry as Geometry);
        expect(broken({ type: 'MultiPolygon', coordinates: null })).toEqual([]);
        expect(broken({ type: 'MultiLineString' })).toEqual([]);
        expect(broken({ type: 'GeometryCollection', geometries: null })).toEqual([]);
        expect(resolveParts('Polygon' as unknown as Geometry)).toEqual([]);
    });
});

describe('extendBounds', () => {
    it('returns south-west and north-east corners, latitude first', () => {
        const parts = [
            ...resolveParts({ type: 'Polygon', coordinates: [outline, hole] }),
            ...resolveParts({ type: 'Point', coordinates: [-30, 55] }),
            ...resolveParts({ type: 'LineString', coordinates: [[12, -5], [3, 3]] }),
        ];
        expect(extendBounds(null, parts)).toEqual([
            [-5, -30],
            [55, 12],
        ]);
    });

    it('is null until something has been added, and grows from a given start', () => {
        expect(extendBounds(null, [])).toBeNull();
        const first = extendBounds(null, resolveParts({ type: 'Point', coordinates: [1, 2] }));
        expect(extendBounds(first, resolveParts({ type: 'Point', coordinates: [5, -3] }))).toEqual([
            [-3, 1],
            [2, 5],
        ]);
    });

    it('has a default that is latitude first too', () => {
        expect(WORLD_BOUNDS).toEqual([
            [-90, -180],
            [90, 180],
        ]);
    });
});

describe('ringCentroid', () => {
    const square: LatLng[] = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
    it('finds the centre of a square, closed or not, in either direction', () => {
        expect(ringCentroid(square)).toEqual([5, 5]);
        expect(ringCentroid(square.slice(0, 4))).toEqual([5, 5]);
        expect(ringCentroid([...square].reverse())).toEqual([5, 5]);
    });
    it('weights by area, so a long thin arm does not pull the centre along with it', () => {
        // An L shape: a 10 by 10 block with a 30 by 1 arm.
        const l: LatLng[] = [[0, 0], [0, 40], [1, 40], [1, 10], [10, 10], [10, 0], [0, 0]];
        const [lat, lng] = ringCentroid(l)!;
        expect(lng).toBeLessThan(12);
        expect(lat).toBeGreaterThan(3);
    });
    it('is null for a ring with no area', () => {
        expect(ringCentroid([[0, 0], [1, 1], [2, 2]])).toBeNull();
        expect(ringCentroid([])).toBeNull();
    });
});
