import { buildEChartsOption } from '../src/index';

describe('buildEChartsOption', () => {
    test('returns option for bar chart', () => {
        const option = buildEChartsOption({
            name: 'test',
            data: [
                { category: 'A', value: 10 },
                { category: 'B', value: 20 },
            ],
            draggableFieldState: {
                dimensions: [], measures: [], rows: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                color: [], opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic', limit: -1 },
            layout: { showTableSummary: false, format: {}, resolve: {}, size: { mode: 'fixed', width: 320, height: 200 }, interactiveScale: false, stack: 'none', showActions: false, zeroScale: true } as any,
            vegaConfig: {},
            chartWidth: 300,
            chartHeight: 180,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).series[0].type).toBe('bar');
    });

    test('auto uses scatter for quantitative x and y', () => {
        const option = buildEChartsOption({
            data: [
                { x: 1, y: 2 },
                { x: 2, y: 3 },
            ],
            draggableFieldState: {
                dimensions: [],
                measures: [
                    { fid: 'x', semanticType: 'quantitative', analyticType: 'measure' },
                    { fid: 'y', semanticType: 'quantitative', analyticType: 'measure' },
                ],
                rows: [{ fid: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [], opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['auto'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 300,
            chartHeight: 180,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).series[0].type).toBe('scatter');
        expect((option as any).xAxis[0].type).toBe('value');
    });

    test('facet creates multiple xAxis and yAxis', () => {
        const option = buildEChartsOption({
            data: [
                { region: 'A', gender: 'male', x: 1, y: 2 },
                { region: 'A', gender: 'female', x: 2, y: 3 },
                { region: 'B', gender: 'male', x: 3, y: 4 },
                { region: 'B', gender: 'female', x: 4, y: 5 },
            ],
            draggableFieldState: {
                dimensions: [
                    { fid: 'region', semanticType: 'nominal', analyticType: 'dimension' },
                    { fid: 'gender', semanticType: 'nominal', analyticType: 'dimension' },
                ],
                measures: [
                    { fid: 'x', semanticType: 'quantitative', analyticType: 'measure' },
                    { fid: 'y', semanticType: 'quantitative', analyticType: 'measure' },
                ],
                rows: [
                    { fid: 'gender', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                columns: [
                    { fid: 'region', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                color: [], opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['point'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 640, height: 360 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 640,
            chartHeight: 360,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).xAxis.length).toBe(4);
        expect((option as any).yAxis.length).toBe(4);
        expect((option as any).grid.length).toBe(4);
    });

    test('supports discrete color grouping', () => {
        const option = buildEChartsOption({
            data: [
                { x: 1, y: 2, c: 'A' },
                { x: 2, y: 3, c: 'B' },
            ],
            draggableFieldState: {
                dimensions: [{ fid: 'c', name: 'color', semanticType: 'nominal', analyticType: 'dimension' } as any],
                measures: [
                    { fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                rows: [{ fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [{ fid: 'c', name: 'color', semanticType: 'nominal', analyticType: 'dimension' } as any],
                opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['point'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).legend.show).toBe(true);
        expect((option as any).series.length).toBe(2);
    });

    test('supports opacity channel via visualMap', () => {
        const option = buildEChartsOption({
            data: [
                { x: 1, y: 2, o: 0.1 },
                { x: 2, y: 3, o: 0.9 },
            ],
            draggableFieldState: {
                dimensions: [],
                measures: [
                    { fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 'o', name: 'opacity', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                rows: [{ fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [],
                opacity: [{ fid: 'o', name: 'opacity', semanticType: 'quantitative', analyticType: 'measure' } as any],
                size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['point'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).visualMap.some((v: any) => v.dimension === 'o' && v.inRange?.opacity)).toBe(true);
    });

    test('supports size channel via visualMap', () => {
        const option = buildEChartsOption({
            data: [
                { x: 1, y: 2, s: 5 },
                { x: 2, y: 3, s: 30 },
            ],
            draggableFieldState: {
                dimensions: [],
                measures: [
                    { fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 's', name: 'size', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                rows: [{ fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [], opacity: [],
                size: [{ fid: 's', name: 'size', semanticType: 'quantitative', analyticType: 'measure' } as any],
                shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['point'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).visualMap.some((v: any) => v.dimension === 's' && v.inRange?.symbolSize)).toBe(true);
    });

    test('supports shape channel with different symbols', () => {
        const option = buildEChartsOption({
            data: [
                { x: 1, y: 2, sh: 'A' },
                { x: 2, y: 3, sh: 'B' },
            ],
            draggableFieldState: {
                dimensions: [{ fid: 'sh', name: 'shape', semanticType: 'nominal', analyticType: 'dimension' } as any],
                measures: [
                    { fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                rows: [{ fid: 'y', name: 'y', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'x', name: 'x', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [], opacity: [], size: [],
                shape: [{ fid: 'sh', name: 'shape', semanticType: 'nominal', analyticType: 'dimension' } as any],
                radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['point'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).series.length).toBe(2);
        expect((option as any).series[0].symbol).not.toBe((option as any).series[1].symbol);
    });
});
