import type { IChart, IViewField } from '../interfaces';
import { emptyEncodings, emptyVisualConfig, emptyVisualLayout } from '../utils/save';
import type { NativeRenderer, NativeUnsupported } from './nativeTypes';
import { routeChart } from './route';

const dim = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' });
const mea = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });
const renderers = ['vega-lite', 'observable-plot', 'native'] as const;
function chart(renderer: IChart['layout']['renderer'], encodings: Partial<IChart['encodings']> = {}, config: Partial<IChart['config']> = {}): IChart {
    return { visId: 'v', name: 'test', encodings: { ...emptyEncodings, rows: [dim('Region')], columns: [mea('Sales')], ...encodings }, config: { ...emptyVisualConfig, ...config }, layout: { ...emptyVisualLayout, renderer } };
}
/** A worksheet capability check whose calls can be inspected. */
function registered(answer?: NativeUnsupported) {
    const asked: IChart[] = [];
    const renderer: NativeRenderer = { component: () => null, check: (c) => (asked.push(c), answer) };
    return { renderer, asked };
}
const worksheet = registered().renderer;
const threeLevels = { rows: [dim('Region'), dim('Category'), dim('Subcategory')] };

describe('routeChart', () => {
    test('a map goes to the map component under every renderer setting, without consulting the worksheet', () => {
        const refusing = registered({ reason: 'never' });
        for (const renderer of renderers) {
            expect(routeChart(chart(renderer, {}, { coordSystem: 'geographic', geoms: ['poi'] }), refusing.renderer)).toEqual({ to: 'dedicated', kind: 'map' });
        }
        // The worksheet renderer is not asked about a chart that is not its to draw.
        expect(refusing.asked).toEqual([]);
    });
    test('a table goes to the table component under every renderer setting, with any number of levels', () => {
        for (const renderer of renderers) {
            expect(routeChart(chart(renderer, threeLevels, { geoms: ['table'] }), worksheet)).toEqual({ to: 'dedicated', kind: 'table' });
        }
    });
    test('an ordinary chart goes to the renderer it names, and to Worksheet where it names none', () => {
        const { renderer: worksheet, asked } = registered();
        expect(routeChart(chart(undefined), worksheet)).toEqual({ to: 'native' });
        expect(routeChart(chart('vega-lite'), worksheet)).toEqual({ to: 'classic' });
        expect(routeChart(chart('observable-plot'), worksheet)).toEqual({ to: 'classic' });
        expect(asked).toHaveLength(1);
        expect(routeChart(chart('native'), worksheet)).toEqual({ to: 'native' });
        expect(asked.length).toBe(2);
    });
    test('a chart the worksheet renderer cannot draw is not drawn by another renderer', () => {
        const route = routeChart(chart('native'), registered({ reason: 'Bar marks need one measure axis.' }).renderer);
        expect(route).toEqual({ to: 'notice', notice: { state: 'unsupported', reason: 'Bar marks need one measure axis.' } });
        // Nothing on the shelves yet is not a fault: the area stays blank.
        expect(routeChart(chart('native'), registered({ reason: 'There is nothing to draw yet.', empty: true }).renderer)).toEqual({ to: 'blank' });
    });
    test('Vega-Lite and Observable Plot do not draw a shelf with more dimensions than they show', () => {
        for (const renderer of ['vega-lite', 'observable-plot'] as const) {
            expect(routeChart(chart(renderer, threeLevels), worksheet)).toEqual({
                to: 'notice',
                notice: { state: 'levels', renderer: renderer ?? 'vega-lite', shelves: [{ shelf: 'rows', fields: ['Region', 'Category', 'Subcategory'] }] },
            });
        }
        const both = routeChart(chart('vega-lite', { ...threeLevels, columns: [dim('Year'), dim('Quarter'), dim('Month'), mea('Sales')] }), worksheet);
        expect(both).toMatchObject({ notice: { shelves: [{ shelf: 'rows' }, { shelf: 'columns', fields: ['Year', 'Quarter', 'Month'] }] } });
        // Two dimensions on a shelf is what the editor allows for these renderers; measures do not count.
        expect(routeChart(chart('vega-lite', { rows: [dim('Region'), dim('Category'), mea('Profit'), mea('Cost')] }), worksheet)).toEqual({ to: 'classic' });
    });
});
