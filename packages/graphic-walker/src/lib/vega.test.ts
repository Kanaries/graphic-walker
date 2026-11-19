import type { IViewField } from '../interfaces';
import { toVegaSpec } from './vega';

const category: IViewField = { fid: 'category', name: 'Category', semanticType: 'nominal', analyticType: 'dimension' };
const group: IViewField = { ...category, fid: 'group', name: 'Group' };
const value: IViewField = { fid: 'value', name: 'Value', semanticType: 'quantitative', analyticType: 'measure' };
const chart = {
    rows: [],
    columns: [],
    color: group,
    text: value,
    dataSource: [],
    interactiveScale: false,
    layoutMode: 'fixed',
    width: 400,
    height: 300,
    defaultAggregated: false,
    stack: 'stack',
    mediaTheme: 'light',
    vegaConfig: {},
} as const;

test('the text layer shares the vertical stack and uses its color ordering', () => {
    const [spec] = toVegaSpec({ ...chart, geomType: 'bar', columns: [category], rows: [value] });
    expect(spec.layer[1]).toMatchObject({
        mark: { type: 'text' },
        encoding: { y: { field: 'value', stack: true }, order: { field: 'group', sort: 'descending' } },
    });
});

test('arc labels follow explicit radius or sit outside the default arc', () => {
    const arc = { ...chart, geomType: 'arc', theta: value };
    const [spec] = toVegaSpec(arc);
    expect(spec.layer[0].mark).toMatchObject({ type: 'arc', outerRadius: 80 });
    expect(spec.layer[1]).toMatchObject({ mark: { type: 'text', radius: 90 }, encoding: { theta: { field: 'value', stack: true } } });
    expect(toVegaSpec({ ...arc, radius: value })[0].layer[1].mark).toMatchObject({ type: 'text', radiusOffset: 10 });
});

test('compiles every repeated layered view with its own selection', () => {
    const { compile } = require('vega-lite');
    const { parse } = require('vega');
    const second = { ...value, fid: 'second' };
    const specs = toVegaSpec({ ...chart, geomType: 'bar', columns: [category], rows: [value, second] });
    expect(specs).toHaveLength(2);
    for (const spec of specs) {
        expect(() => parse(compile(spec).spec)).not.toThrow();
    }
});

test('keeps facet channels outside the layered view', () => {
    const { compile } = require('vega-lite');
    const { parse } = require('vega');
    const [spec] = toVegaSpec({ ...chart, geomType: 'bar', columns: [group, category], rows: [value] });
    expect(spec.facet.column.field).toBe('group');
    expect(compile(spec).spec.marks?.some((mark: { type: string }) => mark.type === 'group')).toBe(true);
    expect(() => parse(compile(spec).spec)).not.toThrow();
});

test('keeps unstacked point labels at the original position and preserves mark scales', () => {
    const [spec] = toVegaSpec({
        ...chart,
        geomType: 'point',
        columns: [category],
        rows: [value],
        size: value,
        opacity: value,
        scales: { size: { range: [100, 200] }, opacity: { range: [0.4, 0.9] } },
    });
    expect(spec.layer[1].encoding.y).toBeUndefined();
    expect(spec.layer[0].encoding.size.scale.range).toEqual([100, 200]);
    expect(spec.layer[0].encoding.opacity.scale.range).toEqual([0.4, 0.9]);
});

test('keeps the heatmap color off the white label layer', () => {
    const [spec] = toVegaSpec({ ...chart, geomType: 'rect', columns: [category], rows: [group] });
    expect(spec.encoding.color).toBeUndefined();
    expect(spec.layer[0].encoding.color.field).toBe('group');
    expect(spec.layer[1].mark.color).toBe('white');
});

test.each([
    ['opacity', false],
    ['size', false],
    ['opacity', true],
    ['size', true],
])('aligns bar labels with stacks grouped by %s without color (aggregated: %s)', async (channel, defaultAggregated) => {
    const { compile } = require('vega-lite');
    const { parse, View } = require('vega');
    const measure = { ...value, aggName: 'sum' };
    const grouping = { ...value, fid: 'sub', aggName: 'mean' };
    const valueKey = defaultAggregated ? 'value_sum' : 'value';
    const groupKey = defaultAggregated ? 'sub_mean' : 'sub';
    const [spec] = toVegaSpec({
        ...chart,
        geomType: 'bar',
        columns: [category],
        rows: [measure],
        text: measure,
        color: undefined,
        defaultAggregated,
        [channel]: grouping,
        dataSource: [{ category: 'A', [valueKey]: 2, [groupKey]: 1 }, { category: 'A', [valueKey]: 3, [groupKey]: 2 }],
    });
    const view = new View(parse(compile(spec).spec), { renderer: 'none' });
    try {
        await view.runAsync();
        const marks = view.scenegraph().root.items[0].items;
        const bars = marks.find((mark) => mark.marktype === 'rect' && mark.role === 'mark').items;
        const labels = marks.find((mark) => mark.marktype === 'text' && mark.role === 'mark').items;
        for (const bar of bars) {
            const label = labels.find((item) => String(item.text) === String(bar.datum[valueKey]));
            expect(label.y).toBeCloseTo(bar.y);
        }
    } finally {
        view.finalize();
    }
});
