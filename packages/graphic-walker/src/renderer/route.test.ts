import type { IChart, IViewField } from '../interfaces';
import { emptyEncodings, emptyVisualConfig, emptyVisualLayout } from '../utils/save';
import type { NativeRegistry, NativeRenderer, NativeUnsupported } from './nativeRegistry';
import { routeChart } from './route';

const dim = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' });
const mea = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });
const renderers = ['vega-lite', 'observable-plot', 'native'] as const;
function chart(renderer: IChart['layout']['renderer'], encodings: Partial<IChart['encodings']> = {}, config: Partial<IChart['config']> = {}): IChart {
    return { visId: 'v', name: 'test', encodings: { ...emptyEncodings, rows: [dim('Region')], columns: [mea('Sales')], ...encodings }, config: { ...emptyVisualConfig, ...config }, layout: { ...emptyVisualLayout, renderer } };
}
/** A registry whose renderer answers every chart the same way, and counts how often it was asked. */
function registered(answer?: NativeUnsupported) {
    const asked: IChart[] = [];
    const renderer: NativeRenderer = { component: () => null, check: (c) => (asked.push(c), answer) };
    return { registry: { renderer, loading: false } as NativeRegistry, asked };
}
const absent: NativeRegistry = { loading: false };
const threeLevels = { rows: [dim('Region'), dim('Category'), dim('Subcategory')] };

describe('routeChart', () => {
    test('a map goes to the map component under every renderer setting, registered or not', () => {
        const refusing = registered({ reason: 'never' });
        for (const renderer of renderers) {
            for (const registry of [absent, { loading: true }, refusing.registry]) {
                expect(routeChart(chart(renderer, {}, { coordSystem: 'geographic', geoms: ['poi'] }), registry)).toEqual({ to: 'dedicated', kind: 'map' });
            }
        }
        // The worksheet renderer is not asked about a chart that is not its to draw.
        expect(refusing.asked).toEqual([]);
    });
    test('a table goes to the table component under every renderer setting, with any number of levels', () => {
        for (const renderer of renderers) {
            expect(routeChart(chart(renderer, threeLevels, { geoms: ['table'] }), absent)).toEqual({ to: 'dedicated', kind: 'table' });
        }
    });
    test('an ordinary chart goes to the renderer it names, and to Worksheet where it names none', () => {
        const { registry, asked } = registered();
        expect(routeChart(chart(undefined), registry)).toEqual({ to: 'native' });
        expect(routeChart(chart('vega-lite'), registry)).toEqual({ to: 'classic' });
        expect(routeChart(chart('observable-plot'), registry)).toEqual({ to: 'classic' });
        expect(asked).toHaveLength(1);
        expect(routeChart(chart('native'), registry)).toEqual({ to: 'native' });
        expect(asked.length).toBe(2);
    });
    test('a chart the worksheet renderer cannot draw is not drawn by another renderer', () => {
        const route = routeChart(chart('native'), registered({ reason: 'Bar marks need one measure axis.' }).registry);
        expect(route).toEqual({ to: 'notice', notice: { state: 'unsupported', reason: 'Bar marks need one measure axis.' } });
        // Nothing on the shelves yet is not a fault: the area stays blank.
        expect(routeChart(chart('native'), registered({ reason: 'There is nothing to draw yet.', empty: true }).registry)).toEqual({ to: 'blank' });
    });
    test('a chart that asks for the worksheet renderer waits for it, and says so where there is none', () => {
        expect(routeChart(chart('native'), { loading: true })).toEqual({ to: 'notice', notice: { state: 'loading' } });
        expect(routeChart(chart('native'), absent)).toEqual({ to: 'notice', notice: { state: 'unavailable' } });
        // Also with a chart the other renderers could draw as it is.
        expect(routeChart(chart('native', { rows: [dim('Region')] }), absent).to).toBe('notice');
    });
    test('Vega-Lite and Observable Plot do not draw a shelf with more dimensions than they show', () => {
        for (const renderer of ['vega-lite', 'observable-plot'] as const) {
            expect(routeChart(chart(renderer, threeLevels), absent)).toEqual({
                to: 'notice',
                notice: { state: 'levels', renderer: renderer ?? 'vega-lite', shelves: [{ shelf: 'rows', fields: ['Region', 'Category', 'Subcategory'] }] },
            });
        }
        const both = routeChart(chart('vega-lite', { ...threeLevels, columns: [dim('Year'), dim('Quarter'), dim('Month'), mea('Sales')] }), absent);
        expect(both).toMatchObject({ notice: { shelves: [{ shelf: 'rows' }, { shelf: 'columns', fields: ['Year', 'Quarter', 'Month'] }] } });
        // Two dimensions on a shelf is what the editor allows for these renderers; measures do not count.
        expect(routeChart(chart('vega-lite', { rows: [dim('Region'), dim('Category'), mea('Profit'), mea('Cost')] }), absent)).toEqual({ to: 'classic' });
    });
});
