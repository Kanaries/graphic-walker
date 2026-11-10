import { compileWorksheet } from '../../worksheet-renderer/src/compiler';
import type { IFilterField, IRow, IViewField } from '../src/interfaces';
import { chartToWorksheet } from './adapter';
import { drawnAtGrain } from './having';
import { chart, dim, drawn, mea } from './testing';

const atLeast = (fid: string, least: number, aggName = 'sum'): IFilterField => ({ ...mea(fid, aggName), enableAgg: true, rule: { type: 'range', value: [least, null] } });

const sales: IRow[] = [
    { Region: 'East', Category: 'A', Sales: 60, Profit: 5 }, { Region: 'East', Category: 'A', Sales: 70, Profit: 5 },
    { Region: 'East', Category: 'B', Sales: 20, Profit: 9 },
    { Region: 'West', Category: 'A', Sales: 30, Profit: 1 },
    { Region: 'West', Category: 'B', Sales: 90, Profit: 2 }, { Region: 'West', Category: 'B', Sales: 40, Profit: 2 },
];

describe('filters on aggregated values', () => {
    test('a group that fails the filter is not drawn', async () => {
        const base = { rows: [dim('Region')], columns: [mea('Sales')] };
        const all = await drawn(chart(base), sales);
        expect(all.having).toBeUndefined();
        expect(all.marks.map((r) => r.Region).sort()).toEqual(['East', 'West']);
        // East sums to 150, West to 160.
        const some = await drawn(chart({ ...base, filters: [atLeast('Sales', 155)] }), sales);
        expect(some.having).toMatchObject({ groupBy: ['Region'], measures: [{ field: 'Sales', agg: 'sum', asFieldKey: 'Sales_sum' }] });
        expect(some.marks.map((r) => r.Region)).toEqual(['West']);
        // The filter comes after the grouping and reads the aggregate under its own name.
        const [{ workflow }] = some.sent;
        expect(workflow.map((step) => step.type)).toEqual(['view', 'filter']);
        expect(workflow[1]).toMatchObject({ filters: [{ fid: 'Sales_sum', rule: { type: 'range', value: [155, null] } }] });
    });
    test('the filter holds at the grain of the marks, in every level of headers', async () => {
        // Sums per Region and Category: East A 130, East B 20, West A 30, West B 130.
        const { marks, model } = await drawn(chart({ rows: [dim('Region'), dim('Category')], columns: [mea('Sales')], filters: [atLeast('Sales', 100)] }), sales);
        expect(marks.map((r) => `${r.Region} ${r.Category}`).sort()).toEqual(['East A', 'West B']);
        expect(model.rows.leaves.length).toBe(2);
    });
    test('a filter may read an aggregate that is not drawn, and every measure axis is filtered alike', async () => {
        // Mean profit per region: East 6.33, West 1.67. Two measures make two queries.
        const { marks, sent } = await drawn(chart({ rows: [dim('Region')], columns: [mea('Sales'), mea('Profit')], filters: [atLeast('Profit', 5, 'mean')] }), sales);
        expect(marks.length).toBeGreaterThan(0);
        expect(new Set(marks.map((r) => r.Region))).toEqual(new Set(['East']));
        for (const { workflow } of sent) {
            const view = workflow.find((step) => step.type === 'view')!;
            expect(view.type === 'view' && view.query[0].op === 'aggregate' && view.query[0].measures.map((m) => m.asFieldKey)).toContain('Profit_mean');
            expect(workflow.some((step) => step.type === 'filter')).toBe(true);
        }
    });
    test('a query that orders members by their totals is not filtered', async () => {
        const sorted: IViewField = { ...dim('Category'), sort: 'descending' };
        const { plan, sent, marks } = await drawn(chart({ rows: [dim('Region'), sorted], columns: [mea('Sales')], filters: [atLeast('Sales', 100)] }), sales);
        expect(plan.rankings.length).toBeGreaterThan(0);
        expect(marks.map((r) => `${r.Region} ${r.Category}`).sort()).toEqual(['East A', 'West B']);
        const grains = sent.map(({ workflow }) => {
            const view = workflow.find((step) => step.type === 'view')!;
            return { groupBy: view.type === 'view' && view.query[0].op === 'aggregate' ? view.query[0].groupBy.length : -1, filtered: workflow.some((step) => step.type === 'filter') };
        });
        // Only queries at the grain of the marks, Region and Category, carry the filter.
        expect(grains.every((g) => g.filtered === (g.groupBy === 2))).toBe(true);
        expect(grains.some((g) => g.filtered)).toBe(true);
    });
    test('without aggregation there is nothing to filter after grouping, as in the other renderers', async () => {
        const { having, marks } = await drawn(chart({ rows: [dim('Region')], columns: [mea('Sales')], filters: [atLeast('Sales', 155)] }, { defaultAggregated: false }), sales);
        expect(having).toBeUndefined();
        expect(marks.length).toBe(sales.length);
    });
    test('a sheet drawn from another grain than the filter is told apart', () => {
        const filtered = chart({ rows: [dim('Region')], columns: [mea('Sales')], filters: [atLeast('Sales', 100)] });
        const bars = compileWorksheet(chartToWorksheet(filtered).spec!);
        expect(drawnAtGrain(bars, ['Region'])).toBe(true);
        expect(drawnAtGrain(bars, ['Region', 'Category'])).toBe(false);
        // A box plot without aggregation reads source rows, which a filter on groups says nothing about.
        const boxes = compileWorksheet(chartToWorksheet(chart({ rows: [dim('Region')], columns: [mea('Sales')] }, { geoms: ['boxplot'], defaultAggregated: false })).spec!);
        expect(boxes.tasks.some((task) => task.raw)).toBe(true);
        expect(drawnAtGrain(boxes, ['Region'])).toBe(false);
    });
});
