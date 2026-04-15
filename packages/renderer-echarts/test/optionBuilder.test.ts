import { buildEChartsOption } from '../src/index';

describe('buildEChartsOption', () => {
    function createBarProps(overrides: Partial<any> = {}) {
        return {
            name: 'test',
            data: [
                { category: 'A', value: 10 },
                { category: 'B', value: 20 },
            ],
            draggableFieldState: {
                dimensions: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                measures: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                rows: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                color: [],
                opacity: [],
                size: [],
                shape: [],
                radius: [],
                theta: [],
                longitude: [],
                latitude: [],
                geoId: [],
                details: [],
                filters: [],
                text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic', limit: -1 },
            layout: { showTableSummary: false, format: {}, resolve: {}, size: { mode: 'fixed', width: 320, height: 200 }, interactiveScale: false, stack: 'stack', showActions: false, zeroScale: true } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
            ...overrides,
        } as any;
    }

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

    test('falls back to vega-lite default primary color when vegaConfig has no color config', () => {
        const option = buildEChartsOption(createBarProps({
            vegaConfig: {},
        }));

        expect(option).toBeTruthy();
        expect((option as any).color).toEqual(['#4C78A8']);
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
        expect(typeof (option as any).series[0].symbolSize).toBe('function');
    });

    test('stacks bar series when details creates multiple rows per category', () => {
        const option = buildEChartsOption(createBarProps({
            data: [
                { category: 'A', value: 10, prep: 'done' },
                { category: 'A', value: 6, prep: 'none' },
                { category: 'B', value: 14, prep: 'done' },
                { category: 'B', value: 9, prep: 'none' },
            ],
            draggableFieldState: {
                ...createBarProps().draggableFieldState,
                dimensions: [
                    { fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'prep', name: 'prep', semanticType: 'nominal', analyticType: 'dimension' } as any,
                ],
                details: [{ fid: 'prep', name: 'prep', semanticType: 'nominal', analyticType: 'dimension' } as any],
            },
        }));

        expect(option).toBeTruthy();
        expect((option as any).series).toHaveLength(2);
        expect((option as any).series.every((item: any) => item.stack === '0:stack')).toBe(true);
    });

    test('stacks bar series when opacity is mapped to a dimension', () => {
        const option = buildEChartsOption(createBarProps({
            data: [
                { category: 'A', value: 10, opacityBand: 'low' },
                { category: 'A', value: 6, opacityBand: 'high' },
                { category: 'B', value: 14, opacityBand: 'low' },
                { category: 'B', value: 9, opacityBand: 'high' },
            ],
            draggableFieldState: {
                ...createBarProps().draggableFieldState,
                dimensions: [
                    { fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'opacityBand', name: 'opacityBand', semanticType: 'nominal', analyticType: 'dimension' } as any,
                ],
                opacity: [{ fid: 'opacityBand', name: 'opacityBand', semanticType: 'nominal', analyticType: 'dimension' } as any],
            },
        }));

        expect(option).toBeTruthy();
        expect((option as any).series).toHaveLength(2);
        expect((option as any).series.every((item: any) => item.stack === '0:stack')).toBe(true);
        expect((option as any).series[0].itemStyle.opacity).not.toBe((option as any).series[1].itemStyle.opacity);
    });

    test('maps bar size to series width and keeps stacked series', () => {
        const option = buildEChartsOption(createBarProps({
            data: [
                { category: 'A', value: 10, widthValue: 8 },
                { category: 'A', value: 6, widthValue: 20 },
                { category: 'B', value: 14, widthValue: 12 },
                { category: 'B', value: 9, widthValue: 28 },
            ],
            draggableFieldState: {
                ...createBarProps().draggableFieldState,
                measures: [
                    { fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 'widthValue', name: 'widthValue', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                size: [{ fid: 'widthValue', name: 'widthValue', semanticType: 'quantitative', analyticType: 'measure' } as any],
            },
        }));

        expect(option).toBeTruthy();
        expect((option as any).series).toHaveLength(1);
        expect((option as any).series[0].type).toBe('custom');
        expect(Object.prototype.hasOwnProperty.call((option as any).series[0], 'data')).toBe(false);
        const source = (option as any).dataset[(option as any).series[0].datasetIndex].source;
        expect(source.every((row: any) => typeof row.__stack_start__ === 'number')).toBe(true);
        expect(source.every((row: any) => typeof row.__stack_end__ === 'number')).toBe(true);
        const ratios = source.map((row: any) => row.__bar_width_ratio__);
        expect(new Set(ratios).size).toBeGreaterThan(1);
    });

    test('uses custom series dataset layout for discrete bar size groups', () => {
        const option = buildEChartsOption(createBarProps({
            data: [
                { category: 'A', value: 10, sizeBand: 'small' },
                { category: 'A', value: 6, sizeBand: 'large' },
                { category: 'B', value: 14, sizeBand: 'small' },
                { category: 'B', value: 9, sizeBand: 'large' },
            ],
            draggableFieldState: {
                ...createBarProps().draggableFieldState,
                dimensions: [
                    { fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'sizeBand', name: 'sizeBand', semanticType: 'nominal', analyticType: 'dimension' } as any,
                ],
                size: [{ fid: 'sizeBand', name: 'sizeBand', semanticType: 'nominal', analyticType: 'dimension' } as any],
            },
        }));

        expect(option).toBeTruthy();
        expect((option as any).series).toHaveLength(2);
        expect((option as any).series.every((item: any) => item.type === 'custom')).toBe(true);
        const datasetSources = (option as any).series.map((item: any) => (option as any).dataset[item.datasetIndex].source);
        const ratios = datasetSources.flatMap((source: any[]) => source.map((row: any) => row.__bar_width_ratio__));
        expect(new Set(ratios).size).toBeGreaterThan(1);
        expect(datasetSources.flat().every((row: any) => typeof row.__stack_start__ === 'number' && typeof row.__stack_end__ === 'number')).toBe(true);
    });

    test('uses custom series dataset layout for transposed quantitative bar size', () => {
        const option = buildEChartsOption({
            data: [
                { category: 'A', value: 10, widthValue: 8 },
                { category: 'B', value: 14, widthValue: 20 },
            ],
            draggableFieldState: {
                dimensions: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                measures: [
                    { fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any,
                    { fid: 'widthValue', name: 'widthValue', semanticType: 'quantitative', analyticType: 'measure' } as any,
                ],
                rows: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                columns: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [], opacity: [],
                size: [{ fid: 'widthValue', name: 'widthValue', semanticType: 'quantitative', analyticType: 'measure' } as any],
                shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).series).toHaveLength(1);
        expect((option as any).series[0].type).toBe('custom');
        expect((option as any).series[0].encode).toEqual({ x: '__stack_end__', y: '__category_value__' });
        const source = (option as any).dataset[(option as any).series[0].datasetIndex].source;
        const ratios = source.map((row: any) => row.__bar_width_ratio__);
        expect(new Set(ratios).size).toBeGreaterThan(1);
    });

    test('uses custom series dataset layout for transposed discrete bar size groups', () => {
        const option = buildEChartsOption({
            data: [
                { category: 'A', series: 'small', value: 10 },
                { category: 'A', series: 'large', value: 6 },
                { category: 'B', series: 'small', value: 14 },
                { category: 'B', series: 'large', value: 9 },
            ],
            draggableFieldState: {
                dimensions: [
                    { fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'series', name: 'series', semanticType: 'nominal', analyticType: 'dimension' } as any,
                ],
                measures: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                rows: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                columns: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [], opacity: [],
                size: [{ fid: 'series', name: 'series', semanticType: 'nominal', analyticType: 'dimension' } as any],
                shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).series.every((item: any) => item.type === 'custom')).toBe(true);
        expect((option as any).series.every((item: any) => JSON.stringify(item.encode) === JSON.stringify({ x: '__stack_end__', y: '__category_value__' }))).toBe(true);
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

    test('uses grouped color series for non-stacked bar charts', () => {
        const option = buildEChartsOption(createBarProps({
            data: [
                { category: 'A', value: 10, lunch: 'standard' },
                { category: 'A', value: 6, lunch: 'free/reduced' },
                { category: 'B', value: 14, lunch: 'standard' },
                { category: 'B', value: 9, lunch: 'free/reduced' },
            ],
            draggableFieldState: {
                ...createBarProps().draggableFieldState,
                dimensions: [
                    { fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'lunch', name: 'lunch', semanticType: 'nominal', analyticType: 'dimension' } as any,
                ],
                color: [{ fid: 'lunch', name: 'lunch', semanticType: 'nominal', analyticType: 'dimension' } as any],
            },
            layout: {
                ...createBarProps().layout,
                stack: 'none',
            },
        }));

        expect(option).toBeTruthy();
        expect((option as any).series).toHaveLength(4);
        expect((option as any).series.every((item: any) => item.stack === undefined)).toBe(true);
        expect((option as any).series.every((item: any) => item.barGap === '-100%')).toBe(true);
        const sources = (option as any).dataset.map((entry: any) => entry.source);
        expect(sources).toHaveLength(4);
        expect(sources.every((rows: any[]) => rows).toBeTruthy());
    });

    test('uses horizontal categorical stack builder for transposed normalize bar charts', () => {
        const option = buildEChartsOption({
            data: [
                { category: 'A', series: 'female', value: 10 },
                { category: 'A', series: 'male', value: 30 },
                { category: 'B', series: 'female', value: 20 },
                { category: 'B', series: 'male', value: 20 },
            ],
            draggableFieldState: {
                dimensions: [
                    { fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any,
                    { fid: 'series', name: 'series', semanticType: 'nominal', analyticType: 'dimension' } as any,
                ],
                measures: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                rows: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                columns: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [{ fid: 'series', name: 'series', semanticType: 'nominal', analyticType: 'dimension' } as any],
                opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {}, stack: 'normalize' } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).xAxis.max).toBe(1);
        expect((option as any).yAxis.inverse).toBe(true);
        expect((option as any).series.every((item: any) => item.stack === 'stack')).toBe(true);
    });

    test('orders transposed line series by category axis', () => {
        const option = buildEChartsOption({
            data: [
                { category: 'B', value: 20 },
                { category: 'A', value: 10 },
                { category: 'C', value: 30 },
            ],
            draggableFieldState: {
                dimensions: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                measures: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                rows: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                columns: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [], opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['line'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        const source = (option as any).dataset[0].source;
        expect(source.map((row: any) => row.category)).toEqual(['A', 'B', 'C']);
        expect((option as any).yAxis[0].inverse).toBe(true);
    });

    test('uses zero baseline for line value axis when zeroScale is enabled', () => {
        const option = buildEChartsOption({
            data: [
                { category: 'A', value: 12 },
                { category: 'B', value: 24 },
            ],
            draggableFieldState: {
                dimensions: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                measures: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                rows: [{ fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure' } as any],
                columns: [{ fid: 'category', name: 'category', semanticType: 'nominal', analyticType: 'dimension' } as any],
                color: [], opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: true, geoms: ['line'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {}, zeroScale: true } as any,
            scales: { y: { zeroScale: true } } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).yAxis[0].min).toBe(0);
    });

    test('renders transposed boxplot with value x-axis and category y-axis', () => {
        const option = buildEChartsOption({
            data: [
                { gender: 'female', score: 70 },
                { gender: 'female', score: 80 },
                { gender: 'male', score: 60 },
                { gender: 'male', score: 90 },
            ],
            draggableFieldState: {
                dimensions: [{ fid: 'gender', name: 'gender', semanticType: 'nominal', analyticType: 'dimension' } as any],
                measures: [{ fid: 'score', name: 'score', semanticType: 'quantitative', analyticType: 'measure' } as any],
                rows: [{ fid: 'gender', name: 'gender', semanticType: 'nominal', analyticType: 'dimension' } as any],
                columns: [{ fid: 'score', name: 'score', semanticType: 'quantitative', analyticType: 'measure' } as any],
                color: [], opacity: [], size: [], shape: [], radius: [], theta: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: []
            },
            visualConfig: { defaultAggregated: false, geoms: ['boxplot'], coordSystem: 'generic', limit: -1 },
            layout: { size: { mode: 'fixed', width: 320, height: 200 }, resolve: {} } as any,
            vegaConfig: {},
            chartWidth: 320,
            chartHeight: 200,
        } as any);

        expect(option).toBeTruthy();
        expect((option as any).xAxis.type).toBe('value');
        expect((option as any).yAxis.type).toBe('category');
        expect((option as any).series[0].encode).toEqual({ x: [1, 2, 3, 4, 5], y: 0 });
    });
});
