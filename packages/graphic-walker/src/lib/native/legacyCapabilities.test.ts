jest.mock('@observablehq/plot', () => ({}));
import type { IViewField } from '../../interfaces';
import { toVegaSpec } from '../vega';
import { toObservablePlotSpec } from '../observablePlot';
import { normalize } from '../../models/normalize';
import { toVegaSimplified, toVegaSimplifiedWithAggergation } from '../../models/chat';
import { getLegacyRendererDiagnostics, LegacyRendererCapabilityError } from './legacyCapabilities';
const dim = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'dimension', semanticType: 'nominal' });
const mea = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' });
const input = (rows: IViewField[], columns: IViewField[] = []) => ({ rows, columns, defaultAggregated: true, geomType: 'bar', layoutMode: 'auto', dataSource: [], width: 400, height: 300, interactiveScale: false, stack: 'none' as const, mediaTheme: 'light' as const, vegaConfig: {} });

test('legacy capability counts enclosing facets rather than total dimensions or measure slots', () => {
    for (const renderer of ['vega-lite', 'observable-plot'] as const) {
        expect(getLegacyRendererDiagnostics(input([dim('a'), dim('b')]), renderer)).toEqual([]);
        expect(getLegacyRendererDiagnostics(input([dim('a'), mea('x'), mea('y')]), renderer)).toEqual([]);
        expect(getLegacyRendererDiagnostics(input([dim('a'), dim('b'), mea('x')]), renderer)).toMatchObject([{ configRef: 'encodings.rows', renderer, code: 'unsupported-renderer' }]);
        expect(getLegacyRendererDiagnostics(input([], [dim('a'), dim('b'), dim('c')]), renderer)).toMatchObject([{ configRef: 'encodings.columns' }]);
    }
});

test('direct Vega and Plot compilers reject lossy nesting and unsupported worksheet settings without changing inputs', () => {
    const deep = input([dim('a'), dim('b'), mea('x')]), before = JSON.stringify(deep);
    for (const compiler of [toVegaSpec, toObservablePlotSpec]) {
        expect(() => compiler(deep)).toThrow(LegacyRendererCapabilityError);
        expect(() => compiler({ ...input([mea('x')]), worksheet: { barLayout: 'grouped' } })).toThrow(/layout.worksheet.barLayout/);
        expect(() => compiler({ ...input([mea('x')]), worksheet: { scaleScopes: { x: { mode: 'pane' } } } })).toThrow(/layout.worksheet.scaleScopes.x/);
    }
    expect(JSON.stringify(deep)).toBe(before);
});

test('existing one-facet charts and multiple measure slots still compile to every Vega view', () => {
    expect(toVegaSpec(input([dim('a'), mea('x'), mea('y')], [dim('b'), dim('c')]))).toHaveLength(2);
    for (const override of [{ geomType: 'table' }, { geomType: 'poi' }, { coordSystem: 'geographic' as const }])
        expect(getLegacyRendererDiagnostics({ ...input([dim('a'), dim('b'), mea('x')]), ...override })).toEqual([]);
});

test('chat reports full canonical fields when the legacy representation is unavailable', () => {
    const chart = normalize({ layout: { renderer: 'native' }, config: { geoms: ['bar'] }, encodings: { rows: [dim('a'), dim('b'), mea('x')] } });
    for (const report of [toVegaSimplified(chart), toVegaSimplifiedWithAggergation(chart)]) {
        expect(report).toMatchObject({ reportType: 'graphic-walker-chart', status: 'unsupported-renderer', chart });
        expect(report.chart.encodings.rows.map((field: IViewField) => field.fid)).toEqual(['a', 'b', 'x']);
        expect(report).not.toHaveProperty('encoding');
    }
});
