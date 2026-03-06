import { buildEChartsOption } from './index';

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
});
