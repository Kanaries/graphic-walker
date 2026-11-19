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
