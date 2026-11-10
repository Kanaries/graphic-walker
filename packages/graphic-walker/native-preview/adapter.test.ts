import { chartToWorksheet } from './adapter';
import { MEA_KEY_ID } from '../src/constants';
import type { IChart, IViewField } from '../src/interfaces';
import { emptyEncodings, emptyVisualConfig, emptyVisualLayout } from '../src/utils/save';

const dim = (fid: string, semanticType: IViewField['semanticType'] = 'nominal', extra: Partial<IViewField> = {}): IViewField => ({ fid, name: fid, semanticType, analyticType: 'dimension', ...extra });
const mea = (fid: string, aggName = 'sum'): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName });
function chart(encodings: Partial<IChart['encodings']>, config: Partial<IChart['config']> = {}, layout: Partial<IChart['layout']> = {}): IChart {
    return {
        visId: 'v', name: 'test',
        encodings: { ...emptyEncodings, ...encodings },
        config: { ...emptyVisualConfig, ...config },
        layout: { ...emptyVisualLayout, renderer: 'native', ...layout },
    };
}
const ids = (expr: any): string[] => (expr.kind === 'field' ? [expr.instanceId] : (expr.items ?? []).flatMap(ids));

describe('chartToWorksheet', () => {
    test('dimensions nest in shelf order and each measure gets its own value axis', () => {
        const { spec, error, viewDimensions, viewMeasures } = chartToWorksheet(chart({
            rows: [dim('Region'), dim('Category'), dim('Sub-Category')],
            columns: [dim('Year', 'ordinal'), mea('Sales'), mea('Profit', 'mean')],
        }));
        expect(error).toBeUndefined();
        expect(ids(spec!.rows).map((id) => spec!.instances[id].field)).toEqual(['Region', 'Category', 'Sub-Category']);
        expect(spec!.rows).toMatchObject({ kind: 'nest' });
        expect((spec!.columns as any).items[1]).toMatchObject({ kind: 'concat' });
        expect(ids(spec!.columns).map((id) => spec!.instances[id])).toMatchObject([
            { field: 'Year', display: 'discrete' },
            { field: 'Sales', display: 'continuous', aggregate: 'sum', label: 'sum(Sales)' },
            { field: 'Profit', display: 'continuous', aggregate: 'mean', label: 'mean(Profit)' },
        ]);
        expect(spec!.mark).toBe('bar');
        expect(viewDimensions.map((f) => f.fid)).toEqual(['Region', 'Category', 'Sub-Category', 'Year']);
        expect(viewMeasures.map((f) => f.fid)).toEqual(['Sales', 'Profit']);
    });
    test('the last dimension of a shelf without measures becomes an axis when it is a date or a number', () => {
        const { spec } = chartToWorksheet(chart({ rows: [mea('Sales')], columns: [dim('Region'), dim('Order Date', 'temporal')] }));
        expect(ids(spec!.columns).map((id) => spec!.instances[id])).toMatchObject([
            { field: 'Region', display: 'discrete' },
            { field: 'Order Date', display: 'continuous', scale: 'time' },
        ]);
        expect(spec!.mark).toBe('line');
        const numeric = chartToWorksheet(chart({ rows: [mea('Sales')], columns: [dim('Age', 'quantitative')] })).spec!;
        expect(numeric.instances[ids(numeric.columns)[0]]).toMatchObject({ display: 'continuous', scale: 'linear', zero: false });
        // A date that is not last on its shelf, or shares the shelf with a measure, stays a header.
        const header = chartToWorksheet(chart({ rows: [dim('Order Date', 'temporal'), mea('Sales')], columns: [dim('Region')] })).spec!;
        expect(header.instances[ids(header.rows)[0]].display).toBe('discrete');
    });
    test('automatic mark follows the shelves', () => {
        const mark = (encodings: Partial<IChart['encodings']>) => chartToWorksheet(chart(encodings)).spec!.mark;
        expect(mark({ rows: [mea('Sales')], columns: [mea('Profit')] })).toBe('point');
        expect(mark({ rows: [dim('Region')], columns: [mea('Sales')] })).toBe('bar');
        expect(mark({ rows: [dim('Region')], columns: [dim('Segment')], text: [mea('Sales')] })).toBe('text');
        expect(mark({ rows: [dim('Region')], columns: [dim('Segment')], color: [mea('Sales')] })).toBe('rect');
        expect(chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] }, { geoms: ['area'] })).spec!.mark).toBe('area');
        // With every record drawn, bars would pile up; the editor's own renderer draws ticks there too.
        expect(chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] }, { defaultAggregated: false })).spec!.mark).toBe('tick');
    });
    test('point, circle and tick stay three different marks', () => {
        const mark = (geom: string) => chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] }, { geoms: [geom] })).spec!.mark;
        expect(['point', 'circle', 'tick'].map(mark)).toEqual(['point', 'circle', 'tick']);
    });
    test('a pie keeps the dimensions on rows and columns as headers and takes its measure from the angle shelf', () => {
        const { spec, notes, viewMeasures } = chartToWorksheet(chart({
            rows: [dim('Region'), dim('Order Date', 'temporal'), mea('Sales')], columns: [dim('Category')],
            theta: [mea('Profit', 'mean')], color: [dim('Segment')], radius: [mea('Quantity')],
        }, { geoms: ['arc'] }));
        expect(spec!.mark).toBe('arc');
        expect(ids(spec!.rows).map((id) => spec!.instances[id])).toMatchObject([{ field: 'Region', display: 'discrete' }, { field: 'Order Date', display: 'discrete' }]);
        expect(ids(spec!.columns).map((id) => spec!.instances[id].field)).toEqual(['Category']);
        expect(spec!.instances[spec!.angle!]).toMatchObject({ field: 'Profit', aggregate: 'mean' });
        expect(viewMeasures.map((f) => f.fid)).toEqual(['Profit']);
        expect(notes).toEqual(['Measures on the row shelf are not part of a pie. The angle shelf sizes the slices.', 'Not drawn yet: radius.']);
        expect(chartToWorksheet(chart({ color: [dim('Segment')] }, { geoms: ['arc'] })).spec!.angle).toBeUndefined();
        expect(chartToWorksheet(chart({ theta: [dim('Segment')] }, { geoms: ['arc'] })).error).toMatch(/Angle is a dimension/);
    });
    test('a box plot keeps every dimension as a header and does not start its axis from zero', () => {
        const { spec, notes } = chartToWorksheet(chart({
            columns: [dim('Region'), dim('Category'), dim('Age', 'quantitative')], rows: [mea('Sales')], color: [mea('Profit')], details: [dim('Customer')],
        }, { geoms: ['boxplot'], defaultAggregated: false }));
        expect(spec!.mark).toBe('boxplot');
        expect(ids(spec!.columns).map((id) => spec!.instances[id].display)).toEqual(['discrete', 'discrete', 'discrete']);
        expect(spec!.instances[ids(spec!.rows)[0]]).toMatchObject({ field: 'Sales', display: 'continuous', zero: false });
        expect(spec!.instances[ids(spec!.rows)[0]].aggregate).toBeUndefined();
        expect(spec!.color).toBeUndefined();
        expect(spec!.detail!.map((id) => spec!.instances[id].field)).toEqual(['Customer']);
        expect(notes).toEqual(['Profit on Color is ignored: a box plot takes a dimension there.']);
    });
    test('color takes a dimension as categories and a measure as a continuous scale', () => {
        const byDimension = chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')], color: [dim('Segment')], details: [dim('Ship Mode')] })).spec!;
        expect(byDimension.instances[byDimension.color!]).toMatchObject({ field: 'Segment', display: 'discrete' });
        expect(byDimension.detail!.map((id) => byDimension.instances[id].field)).toEqual(['Ship Mode']);
        const byMeasure = chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')], color: [mea('Profit', 'mean')] })).spec!;
        expect(byMeasure.instances[byMeasure.color!]).toMatchObject({ field: 'Profit', display: 'continuous', aggregate: 'mean' });
    });
    test('without aggregation measures are plain continuous fields', () => {
        const { spec } = chartToWorksheet(chart({ rows: [mea('Sales')], columns: [mea('Profit')] }, { defaultAggregated: false }));
        expect(Object.values(spec!.instances).every((f) => f.display === 'continuous' && !f.aggregate)).toBe(true);
    });
    test('a date drilled to a unit is labelled by its period in the display time zone', () => {
        const year = dim('Order Year', 'temporal', { computed: true, timeUnit: 'year' });
        const header = chartToWorksheet(chart({ rows: [year, mea('Sales')], columns: [dim('Region')] }, { timezoneDisplayOffset: 480 })).spec!;
        expect(header.instances[ids(header.rows)[0]]).toMatchObject({ display: 'discrete', scale: 'time', timeUnit: 'year', timeOffset: -480 * 60000 });
        const axis = chartToWorksheet(chart({ rows: [mea('Sales')], columns: [year] }, { timezoneDisplayOffset: 0 })).spec!;
        expect(axis.instances[ids(axis.columns)[0]]).toMatchObject({ display: 'continuous', scale: 'time', timeOffset: -0 });
        expect(axis.mark).toBe('line');
    });
    test('a sorted dimension is ordered by the measure across from it, and the limit follows that order', () => {
        const sorted = (extra: Partial<IViewField> = {}) => dim('Sub-Category', 'nominal', { sort: 'descending', ...extra });
        const { spec, notes } = chartToWorksheet(chart({ rows: [dim('Category'), sorted()], columns: [dim('Year', 'ordinal'), mea('Sales'), mea('Profit', 'mean')] }, { limit: 10 }));
        const sub = ids(spec!.rows)[1], sales = ids(spec!.columns)[1];
        expect(spec!.instances[sales]).toMatchObject({ field: 'Sales', aggregate: 'sum' });
        // The first of several measures decides, as the leftmost does in Tableau.
        expect(spec!.order).toEqual({ [sub]: { by: sales, direction: 'descending' } });
        expect(spec!.limit).toEqual({ rows: 10, by: sales, direction: 'descending' });
        expect(notes).toEqual([]);
        // Measure on the same shelf as the dimension: the dimension across from it is the one that carries the sort.
        const across = chartToWorksheet(chart({ rows: [dim('Region'), mea('Sales')], columns: [dim('Year', 'ordinal', { sort: 'ascending' })] })).spec!;
        expect(across.order).toEqual({ [ids(across.columns)[0]]: { by: ids(across.rows)[1], direction: 'ascending' } });
        expect(across.limit).toBeUndefined();
        // A date axis has no members to reorder.
        expect(chartToWorksheet(chart({ rows: [mea('Sales')], columns: [dim('Order Date', 'temporal', { sort: 'descending' })] })).spec!.order).toEqual({});
        expect(chartToWorksheet(chart({ rows: [sorted()], columns: [dim('Region')] })).notes).toEqual(['There is no measure to sort by; members are in value order.']);
        // A limit without a sort keeps the first records as they come.
        expect(chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] }, { limit: 5 })).spec!.limit).toEqual({ rows: 5 });
    });
    test('with every record drawn, members are ordered by a total and the limit by the records', () => {
        const raw = chartToWorksheet(chart({ rows: [dim('Region', 'nominal', { sort: 'descending' })], columns: [mea('Sales')] }, { defaultAggregated: false, limit: 100 })).spec!;
        const region = ids(raw.rows)[0], sales = ids(raw.columns)[0];
        expect(raw.instances[sales].aggregate).toBeUndefined();
        expect(raw.instances.order).toMatchObject({ field: 'Sales', aggregate: 'sum' });
        expect(raw.order).toEqual({ [region]: { by: 'order', direction: 'descending' } });
        expect(raw.limit).toEqual({ rows: 100, by: sales, direction: 'descending' });
        const box = chartToWorksheet(chart({ columns: [dim('Region', 'nominal', { sort: 'ascending' })], rows: [mea('Sales')] }, { defaultAggregated: false, geoms: ['boxplot'] })).spec!;
        expect(box.instances.order).toMatchObject({ field: 'Sales', aggregate: 'median' });
    });
    test('layout options carry over', () => {
        const base = { rows: [dim('Region')], columns: [mea('Sales')] };
        expect(chartToWorksheet(chart(base, {}, { stack: 'none' })).spec!.stack).toBe(false);
        expect(chartToWorksheet(chart(base, {}, { stack: 'stack' })).spec!.stack).toBe(true);
        expect(chartToWorksheet(chart(base, {}, { stack: 'zero' })).spec!.stack).toBe(true);
        expect(chartToWorksheet(chart(base, {}, { stack: 'normalize' })).spec!.stack).toBe('normalize');
        expect(chartToWorksheet(chart(base, {}, { stack: 'center' })).spec!.stack).toBe('center');
        const independent = chartToWorksheet(chart(base, {}, { resolve: { ...emptyVisualLayout.resolve, x: true } })).spec!;
        expect(independent.scaleScope).toBe('independent');
        const noZero = chartToWorksheet(chart(base, {}, { zeroScale: false })).spec!;
        expect(noZero.instances[ids(noZero.columns)[0]].zero).toBe(false);
    });
    test('what cannot be drawn is reported, not dropped silently', () => {
        expect(chartToWorksheet(chart({ rows: [dim(MEA_KEY_ID)], columns: [mea('Sales')] })).error).toMatch(/Measure names/);
        expect(chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] }, { geoms: ['table'] })).error).toMatch(/"table"/);
        expect(chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales', 'expr')] })).error).toMatch(/"expr"/);
        expect(chartToWorksheet(chart({}, { coordSystem: 'geographic' })).error).toMatch(/Maps/);
        expect(chartToWorksheet(chart({})).error).toMatch(/nothing on rows or columns/);
        expect(chartToWorksheet(chart({ color: [dim('Segment')] })).error).toMatch(/nothing on rows or columns/);
        const { spec, notes } = chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')], size: [mea('Profit')], details: [mea('Quantity')] }, {}, { stack: 'normalize' }));
        expect(spec).toBeDefined();
        expect(notes).toEqual(['Quantity on Details is ignored: only dimensions split marks.', 'Not drawn yet: size.']);
        const settings = chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] }, { limit: 10, geoms: ['trail'] },
            { format: { numberFormat: '.2f' }, scale: { opacity: { rangeMax: 1 } }, interactiveScale: true, size: { mode: 'fixed', width: 300, height: 200 }, useSvg: true, resolve: { color: true } }));
        expect(settings.notes).toEqual([
            'Trail is drawn as a line of one width.', 'Number and time formats are not applied.', 'Scale settings are not applied.',
            'Independent legends are not drawn.', 'Axes cannot be zoomed or panned.', 'The chart size setting is not applied; the sheet takes the space it needs.', 'The sheet is always drawn on a canvas.',
        ]);
        // A chart with default settings drops nothing.
        expect(chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] })).notes).toEqual([]);
    });
});
