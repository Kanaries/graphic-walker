import { buildScene } from '../../../../worksheet-renderer/src/scene';
import type { IDataQueryPayload, IFilterField, IRow, IViewField } from '../../interfaces';
import { toWorkflow } from '../../utils/workflow';
import { chartToWorksheet } from './adapter';
import { calc, chart, dim, drawn, local, mea } from './testing';

// Aggregate expressions in the worksheet renderer, checked against the editor's own workflow and the
// functions its local computation runs. Nothing here works an expression out by other means.

const ratio = calc('f_ratio', 'Ratio', 'sum(Sales) / sum(Cost)', 'aggregate');
const margin = calc('f_margin', 'Margin', 'Sales - Cost', 'row');
const rate = calc('f_rate', 'Rate', 'sum(Margin) / sum(Sales)', 'aggregate');
const broken = calc('f_broken', 'Broken', 'sum(Nope) / sum(Cost)', 'aggregate');
const dimensions = [dim('Region'), dim('Category'), dim('Sub')];
const measures = [mea('Sales'), mea('Cost'), ratio, margin, rate, broken];
const dataset = { dimensions, measures };
// East and West hold members of the same name. West, B, b1 has a cost of zero.
const orders: IRow[] = [
    { Region: 'East', Category: 'A', Sub: 'a1', Sales: 10, Cost: 1 },
    { Region: 'East', Category: 'A', Sub: 'a1', Sales: 20, Cost: 9 },
    { Region: 'East', Category: 'A', Sub: 'a2', Sales: 8, Cost: 4 },
    { Region: 'East', Category: 'B', Sub: 'b1', Sales: 9, Cost: 3 },
    { Region: 'West', Category: 'A', Sub: 'a1', Sales: 6, Cost: 12 },
    { Region: 'West', Category: 'A', Sub: 'a2', Sales: 15, Cost: 5 },
    { Region: 'West', Category: 'B', Sub: 'b1', Sales: 7, Cost: 0 },
];
const key = (row: IRow, fields: string[]) => fields.map((f) => row[f]).join(' / ');
/** What the editor's other renderers would be given for the same fields: its own workflow, run by its own functions. */
async function reference(viewDimensions: IViewField[], measure: IViewField, filters: IFilterField[] = [], sort: 'none' | 'ascending' | 'descending' = 'none', limit?: number) {
    const rows = await local(orders, toWorkflow(filters, [...dimensions, ...measures], viewDimensions, [measure], true, sort, [], limit), limit);
    return Object.fromEntries(rows.map((row) => [key(row, viewDimensions.map((f) => f.fid)), row[measure.fid]]));
}
const views = (payload: IDataQueryPayload) => payload.workflow.flatMap((step) => (step.type === 'view' ? step.query : [])).flatMap((query) => (query.op === 'aggregate' ? [query] : []));

describe('aggregate expressions', () => {
    test('E1: three levels of headers, each mark at the grain of all of them, as the editor computes it', async () => {
        const { model, marks, plan } = await drawn(chart({ ...dataset, rows: dimensions, columns: [ratio] }), orders);
        expect(model.rows.levels.map((level) => [...new Set(level.map((span) => span.part.value))])).toEqual([['East', 'West'], ['A', 'B'], ['a1', 'a2', 'b1']]);
        expect(model.rows.leaves.length).toBe(6);
        expect(plan.tasks.map((task) => task.groupBy)).toEqual([['Category', 'Region', 'Sub']]);
        const shown = Object.fromEntries(marks.map((r) => [key(r, ['Region', 'Category', 'Sub']), r.__ws_columnm0]));
        expect(shown).toEqual(await reference(dimensions, ratio));
        // Members of the same name under East and under West are different marks.
        expect(shown['East / A / a1']).toBe(3);
        expect(shown['West / A / a1']).toBe(0.5);
    });

    test('E2: the expression is worked out over the rows of a group, not per row and not from finer groups', async () => {
        // East, A, a1 holds 10 / 1 and 20 / 9. A ratio of sums is 30 / 10; ratios per row would add up to 12.2 or average 6.1.
        const fine = await drawn(chart({ ...dataset, rows: dimensions, columns: [ratio] }), orders);
        expect(fine.marks.find((r) => r.Region === 'East' && r.Sub === 'a1')!.__ws_columnm0).toBe(3);
        // East as a whole is 47 / 17. Its three finer groups are 3, 2 and 3, which neither add up nor average to that.
        const coarse = await drawn(chart({ ...dataset, rows: [dim('Region')], columns: [ratio] }), orders);
        expect(coarse.marks.find((r) => r.Region === 'East')!.__ws_columnm0).toBeCloseTo(47 / 17, 10);
        // The fields the expression reads do not join the grouping.
        expect(views(coarse.sent[0])[0].groupBy).toEqual(['Region']);
    });

    test('E3: next to a plain measure and on several channels at once, every use has its own result column', async () => {
        const c = chart({ ...dataset, rows: [dim('Region')], columns: [ratio, mea('Sales')], color: [ratio], text: [ratio], size: [ratio] }, { geoms: ['bar'] });
        const { sent, marks, model, csv, plan } = await drawn(c, orders);
        expect(plan.tasks.length).toBe(1);
        const [query] = views(sent[0]);
        const expression = '((sum ("Sales") ) / (sum ("Cost") ))';
        expect(query.measures).toEqual([
            { field: expression, agg: 'expr', asFieldKey: '__ws_columnm0' },
            { field: expression, agg: 'expr', asFieldKey: '__ws_color' },
            { field: expression, agg: 'expr', asFieldKey: '__ws_text' },
            { field: expression, agg: 'expr', asFieldKey: '__ws_size' },
            { field: 'Sales', agg: 'sum', asFieldKey: '__ws_columnm1' },
        ]);
        const east = marks.find((r) => r.Region === 'East')!, west = marks.find((r) => r.Region === 'West')!;
        for (const [record, value, sales] of [[east, 47 / 17, 47], [west, 28 / 17, 28]] as const) {
            for (const column of ['__ws_columnm0', '__ws_color', '__ws_text', '__ws_size']) expect(record[column]).toBeCloseTo(value, 10);
            expect(record.__ws_columnm1).toBe(sales);
        }
        // Tooltips name the expression once and the plain measure next to it, in both panes; labels write the same number.
        const scene = buildScene(model, { x: 0, y: 0, width: model.width, height: model.height });
        const tips = scene.items.filter((p) => p.selection?.values.Region === 'East' && p.tooltip).map((p) => p.tooltip!);
        // A mark names the fields of its own pane: the bar on the Ratio axis the ratio, the bar on the Sales axis both.
        expect([...new Set(tips)].sort()).toEqual(['Region: East\nRatio: 2.76', 'Region: East\nsum(Sales): 47\nRatio: 2.76']);
        expect(scene.items.some((p) => p.kind === 'text' && p.text === '2.76')).toBe(true);
        // The exported table holds what the marks were drawn from.
        expect(csv).toHaveLength(1);
        const [header, ...lines] = csv[0].split('\n');
        expect(header).toBe('Region,Ratio,Ratio,Ratio,Ratio,sum(Sales)');
        expect(lines.map((line) => line.split(','))).toEqual([
            ['East', ...Array(4).fill(String(47 / 17)), '47'],
            ['West', ...Array(4).fill(String(28 / 17)), '28'],
        ]);
    });

    test('E4: row filters, a filter on the expression, ordering and the limit keep their order and meaning', async () => {
        const onlyA: IFilterField = { ...dim('Category'), rule: { type: 'one of', value: ['A'] } };
        const atLeast = (least: number): IFilterField => ({ ...ratio, enableAgg: true, rule: { type: 'range', value: [least, null] } });
        const rows = [dim('Region'), dim('Sub')];
        // Category A alone: East a1 is 3, East a2 is 2, West a1 is 0.5, West a2 is 3.
        const some = await drawn(chart({ ...dataset, rows, columns: [ratio], filters: [onlyA, atLeast(2.5)] }), orders);
        expect(some.marks.map((r) => key(r, ['Region', 'Sub'])).sort()).toEqual(['East / a1', 'West / a2']);
        expect(Object.fromEntries(some.marks.map((r) => [key(r, ['Region', 'Sub']), r.__ws_columnm0]))).toEqual(await reference(rows, ratio, [onlyA, atLeast(2.5)]));
        // Rows are filtered first, groups are filtered after the expression is worked out, under the filter's own name.
        expect(some.sent[0].workflow.map((step) => step.type)).toEqual(['filter', 'view', 'filter']);
        expect(views(some.sent[0])[0].measures.map((m) => m.asFieldKey)).toEqual(['__ws_columnm0', 'f_ratio']);
        expect(some.sent[0].workflow[2]).toMatchObject({ filters: [{ fid: 'f_ratio', rule: { type: 'range', value: [2.5, null] } }] });
        // A filter no group passes leaves an empty sheet, not an error and not the unfiltered marks.
        const none = await drawn(chart({ ...dataset, rows, columns: [ratio], filters: [onlyA, atLeast(100)] }), orders);
        expect(none.marks).toEqual([]);
        expect(none.model.panes.flatMap((pane) => pane.marks)).toEqual([]);

        // The three groups with the highest ratio, as the editor's own sort and limit pick them.
        const sorted = [dim('Region'), { ...dim('Sub'), sort: 'descending' as const }];
        const top = await drawn(chart({ ...dataset, rows: sorted, columns: [ratio], filters: [onlyA] }, { limit: 3 }), orders);
        expect(Object.fromEntries(top.marks.map((r) => [key(r, ['Region', 'Sub']), r.__ws_columnm0]))).toEqual(await reference(rows, ratio, [onlyA], 'descending', 3));
        expect(top.marks.map((r) => key(r, ['Region', 'Sub'])).sort()).toEqual(['East / a1', 'East / a2', 'West / a2']);
        const cut = top.sent.find((payload) => payload.limit)!;
        expect(cut.workflow.map((step) => step.type)).toEqual(['filter', 'view', 'sort']);
        expect(cut.limit).toBe(3);
        // The query that orders the members of Sub inside each region is another one. It is not cut, and it works
        // the expression out again at its own grain under its own name rather than reading the marks' column.
        const others = top.sent.filter((payload) => payload !== cut);
        expect(others.length).toBeGreaterThan(0);
        for (const payload of others) {
            expect(payload.limit).toBeUndefined();
            expect(views(payload)[0].measures.every((m) => m.agg === 'expr' && m.field.includes('sum'))).toBe(true);
        }
    });

    test('E5: computed inputs, missing values, division by zero and a wrong expression follow the editor', async () => {
        // Rate reads Margin, which is computed per row and is not on any shelf. It has to exist before the grouping.
        const rated = await drawn(chart({ ...dataset, rows: [dim('Region')], columns: [rate] }), orders);
        expect(rated.sent[0].workflow.map((step) => step.type)).toEqual(['transform', 'view']);
        expect(rated.sent[0].workflow[0]).toMatchObject({ transform: [{ key: 'f_margin' }] });
        expect(views(rated.sent[0])[0].groupBy).toEqual(['Region']);
        const shown = Object.fromEntries(rated.marks.map((r) => [r.Region, r.__ws_columnm0]));
        expect(shown.East).toBeCloseTo((47 - 17) / 47, 10);
        expect(shown.West).toBeCloseTo((28 - 17) / 28, 10);
        expect(shown).toEqual(await reference([dim('Region')], rate));

        // A group whose divisor is zero comes out of the editor's computation as infinity. The sheet keeps the record
        // as computed and draws no mark for it: no length is made up, and the axis ranges over the finite values only.
        const fine = await drawn(chart({ ...dataset, rows: dimensions, columns: [ratio] }), orders);
        const expected = await reference(dimensions, ratio);
        expect(expected['West / B / b1']).toBe(Infinity);
        expect(fine.marks.find((r) => r.Region === 'West' && r.Sub === 'b1')!.__ws_columnm0).toBe(Infinity);
        const mark = fine.model.panes.flatMap((pane) => pane.marks).find((m) => m.record.Region === 'West' && m.record.Sub === 'b1')!;
        expect([mark.start, mark.end]).toEqual([NaN, NaN]);
        expect(fine.model.columns.leaves[0].scale!.domain).toEqual([0, 3]);
        // A missing value among the rows of a group is treated as the editor's sum treats it.
        const sparse = [...orders, { Region: 'North', Category: 'A', Sub: 'a1', Sales: null, Cost: 4 }];
        const north = await drawn(chart({ ...dataset, rows: [dim('Region')], columns: [ratio] }), sparse);
        const northReference = await local(sparse, toWorkflow([], [...dimensions, ...measures], [dim('Region')], [ratio], true, 'none'));
        expect(north.marks.find((r) => r.Region === 'North')!.__ws_columnm0).toBe(northReference.find((r) => r.Region === 'North')!.f_ratio);

        // An expression the computation rejects is an error with its message. Nothing is drawn in its place.
        await expect(drawn(chart({ ...dataset, rows: [dim('Region')], columns: [broken] }), orders)).rejects.toThrow(/no field named nope/);
        // So is an aggregate expression the editor has typed as a dimension: there are no members to group by.
        expect(chartToWorksheet(chart({ ...dataset, rows: [{ ...ratio, analyticType: 'dimension', semanticType: 'nominal' }], columns: [mea('Sales')] })).error).toMatch(/Ratio is an aggregate expression, but it is set as a dimension/);
        // A field that claims to be an aggregate expression without one is refused before any query.
        expect(chartToWorksheet(chart({ dimensions, measures: [], rows: [dim('Region')], columns: [{ ...ratio, expression: undefined }] })).error).toMatch(/Ratio is an aggregate expression/);
    });

    test('E5: without aggregation an aggregate expression is not drawn, as in the other renderers', async () => {
        const { sent, plan, marks } = await drawn(chart({ ...dataset, rows: [dim('Region')], columns: [ratio, mea('Sales')] }, { defaultAggregated: false }), orders);
        expect(Object.values(plan.spec.instances).map((f) => f.field)).toEqual(['Region', 'Sales']);
        expect(JSON.stringify(sent)).not.toMatch(/expr/);
        expect(marks.length).toBe(orders.length);
        expect(chartToWorksheet(chart({ ...dataset, rows: [dim('Region')], columns: [ratio] }, { defaultAggregated: false })).notes.join(' ')).toMatch(/Ratio: an aggregate expression is not drawn while aggregation is off/);
    });

    test("E6: the expression goes to the host's computation as the editor writes it, and the sheet shows what comes back", async () => {
        // A host that answers every group with a number no local computation would give.
        const received: IDataQueryPayload[] = [];
        const host = async (payload: IDataQueryPayload) => {
            received.push(payload);
            const [query] = views(payload);
            return ['East', 'West'].map((Region, index) => ({ Region, ...Object.fromEntries(query.measures.map((m) => [m.asFieldKey, 1000 + index])) }));
        };
        const sorted = { ...dim('Region'), sort: 'descending' as const };
        const { marks, model } = await drawn(chart({ ...dataset, rows: [sorted], columns: [rate], color: [ratio] }), orders, host);
        expect(received.length).toBeGreaterThan(0);
        for (const payload of received) {
            // Computed inputs first, then one grouping that carries the expressions as text for the host to evaluate.
            expect(payload.workflow.map((step) => step.type)).toEqual(['transform', 'view']);
            expect(payload.workflow[0]).toMatchObject({ transform: [{ key: 'f_margin', expression: { op: 'expr' } }] });
            const [query] = views(payload);
            expect(query.groupBy).toEqual(['Region']);
            expect(query.measures).toEqual([
                { field: '((sum (f_margin) ) / (sum ("Sales") ))', agg: 'expr', asFieldKey: '__ws_columnm0' },
                { field: '((sum ("Sales") ) / (sum ("Cost") ))', agg: 'expr', asFieldKey: '__ws_color' },
            ]);
        }
        expect(marks.map((r) => [r.Region, r.__ws_columnm0, r.__ws_color])).toEqual([['East', 1000, 1000], ['West', 1001, 1001]]);
        // The members are ordered by what the host returned, highest first.
        expect(model.rows.levels[0].map((span) => span.part.value)).toEqual(['West', 'East']);
    });
});
