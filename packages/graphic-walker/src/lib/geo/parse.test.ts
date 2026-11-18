import { GeoDataError, fetchGeoJson, geoDataErrorOf, isTopology, parseGeoText, toFeatureCollection, topologyObjectKeys } from './parse';

const square = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
const feature = { type: 'Feature', id: 'a', properties: { name: 'A' }, geometry: { type: 'Polygon', coordinates: [square] } };
const collection = { type: 'FeatureCollection', features: [feature] };
const topology = {
    type: 'Topology',
    arcs: [square, [[5, 5], [6, 5], [6, 6], [5, 5]]],
    objects: {
        outline: { type: 'Polygon', arcs: [[0]], properties: { name: 'Whole' } },
        regions: {
            type: 'GeometryCollection',
            geometries: [
                { type: 'Polygon', arcs: [[0]], id: 'a', properties: { name: 'A' } },
                { type: 'Polygon', arcs: [[1]], id: 'b', properties: { name: 'B' } },
            ],
        },
    },
};
const codeOf = (run: () => unknown) => {
    try {
        run();
    } catch (error) {
        return geoDataErrorOf(error);
    }
    return undefined;
};

describe('toFeatureCollection', () => {
    it('takes a FeatureCollection as it is and wraps a lone feature', () => {
        expect(toFeatureCollection(collection)).toBe(collection);
        expect(toFeatureCollection(feature)).toEqual(collection);
    });

    it('converts a topology, whatever the caller thought the file was', () => {
        expect(isTopology(topology)).toBe(true);
        expect(topologyObjectKeys(topology)).toEqual(['outline', 'regions']);
        expect(topologyObjectKeys(collection)).toEqual([]);
        const regions = toFeatureCollection(topology, 'regions');
        expect(regions.features.map((f) => [f.id, f.properties?.name])).toEqual([
            ['a', 'A'],
            ['b', 'B'],
        ]);
        expect(regions.features[0].geometry).toEqual({ type: 'Polygon', coordinates: [square] });
    });

    it('uses the first object by default, and wraps an object that is a single shape', () => {
        const outline = toFeatureCollection(topology);
        expect(outline.type).toBe('FeatureCollection');
        expect(outline.features).toHaveLength(1);
        expect(outline.features[0].properties).toEqual({ name: 'Whole' });
    });

    it('names the objects a topology has when the requested one is missing', () => {
        expect(codeOf(() => toFeatureCollection(topology, 'states'))).toEqual({ code: 'object', detail: 'outline, regions' });
    });

    it('rejects JSON that holds no shapes', () => {
        expect(codeOf(() => toFeatureCollection({ rows: [] }))).toEqual({ code: 'format', detail: '' });
        expect(codeOf(() => toFeatureCollection({ type: 'Polygon', coordinates: [square] }))).toEqual({ code: 'format', detail: 'Polygon' });
        expect(codeOf(() => toFeatureCollection([collection]))).toEqual({ code: 'format', detail: '' });
        expect(codeOf(() => toFeatureCollection(null))).toEqual({ code: 'format', detail: '' });
        expect(codeOf(() => toFeatureCollection('text'))).toEqual({ code: 'format', detail: '' });
    });

    it('rejects a collection whose features are not objects, and keeps a feature without geometry', () => {
        expect(codeOf(() => toFeatureCollection({ type: 'FeatureCollection', features: [null] }))).toEqual({ code: 'format', detail: 'features' });
        expect(codeOf(() => toFeatureCollection({ type: 'FeatureCollection', features: [feature, 'text'] }))).toEqual({ code: 'format', detail: 'features' });
        const bare = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'A' }, geometry: null }] };
        expect(toFeatureCollection(bare)).toBe(bare);
    });
});

describe('parseGeoText', () => {
    it('parses JSON and says so when the text is something else', () => {
        expect(parseGeoText(JSON.stringify(collection))).toEqual(collection);
        expect(codeOf(() => parseGeoText('<html>Not found</html>'))?.code).toBe('json');
    });
});

describe('geoDataErrorOf', () => {
    it('reads a GeoDataError and treats anything else as a format problem', () => {
        expect(geoDataErrorOf(new GeoDataError('http', '404'))).toEqual({ code: 'http', detail: '404' });
        expect(geoDataErrorOf(new TypeError('boom'))).toEqual({ code: 'format', detail: 'boom' });
        expect(geoDataErrorOf('invalid geojson')).toEqual({ code: 'format', detail: '' });
    });
});

describe('fetchGeoJson', () => {
    const realFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = realFetch;
    });
    const answer = (response: Partial<Response> | Error) => {
        globalThis.fetch = jest.fn(async () => {
            if (response instanceof Error) throw response;
            return response as Response;
        });
    };
    const failure = async () => geoDataErrorOf(await fetchGeoJson('https://example.test/map.json').catch((e) => e));

    it('returns the parsed file', async () => {
        answer({ ok: true, status: 200, text: async () => JSON.stringify(collection) });
        expect(await fetchGeoJson('https://example.test/map.json')).toEqual(collection);
    });

    it('tells a failed request, an error status and a non-JSON answer apart', async () => {
        answer(new TypeError('Failed to fetch'));
        expect(await failure()).toEqual({ code: 'network', detail: 'Failed to fetch' });
        answer({ ok: false, status: 404, text: async () => 'Not Found' });
        expect(await failure()).toEqual({ code: 'http', detail: '404' });
        answer({ ok: true, status: 200, text: async () => '<html></html>' });
        expect((await failure()).code).toBe('json');
    });
});
