import type { IViewField } from '../interfaces';
import { createPivotPathKey } from '../components/pivotTable/utils';
import { buildPivotTable } from './buildPivotTable';

const dimension = (fid: string): IViewField => ({
    fid,
    name: fid,
    analyticType: 'dimension',
    semanticType: 'nominal',
});

describe('buildPivotTable', () => {
    test('builds row and column trees with collapsed subtotals', () => {
        const data = [
            { region: 'East', city: 'Boston', year: '2024', sales_sum: 9 },
            { region: 'West', city: 'Seattle', year: '2024', sales_sum: 18 },
            { region: 'West', city: 'San Francisco', year: '2024', sales_sum: 12 },
        ];
        const result = buildPivotTable(
            [dimension('region'), dimension('city')],
            [dimension('year')],
            data,
            [{ region: 'West', year: '2024', sales_sum: 30 }],
            [createPivotPathKey([{ key: 'region', value: 'West' }])],
            false
        );

        expect(result.lt.children.find((node) => node.value === 'West')?.isCollapsed).toBe(true);
        expect(result.tt.children.map((node) => node.value)).toEqual(['2024']);
        expect(result.metric.map((row) => row[0]?.sales_sum)).toEqual([9, 30]);
    });

    test('sorts the opposite axis using the selected measure', () => {
        const data = [
            { region: 'East', year: '2024', sales_sum: 9 },
            { region: 'West', year: '2024', sales_sum: 30 },
        ];
        const result = buildPivotTable([dimension('region')], [dimension('year')], data, [], [], false, {
            fid: 'sales_sum',
            mode: 'row',
            type: 'descending',
        });

        expect(result.lt.children.map((node) => node.value)).toEqual(['West', 'East']);
    });

    test.each([
        { mode: 'row' as const, dimsInRow: [dimension('region')], dimsInColumn: [dimension('year')] },
        { mode: 'column' as const, dimsInRow: [dimension('region')], dimsInColumn: [dimension('year')] },
    ])('builds an empty model without throwing when $mode sorting is active', ({ mode, dimsInRow, dimsInColumn }) => {
        const result = buildPivotTable(dimsInRow, dimsInColumn, [], [], [], false, {
            fid: 'sales_sum',
            mode,
            type: 'descending',
        });

        expect(result.lt.children).toEqual([]);
        expect(result.tt.children).toEqual([]);
        expect(result.metric).toEqual([[undefined]]);
    });
});

test('keeps manual and alphabetical header orders, and computes running totals in each partition', () => {
    const month: IViewField = { ...dimension('month'), sortType: 'manual', sortList: ['Mar', 'Jan', 'Feb'] };
    const channel: IViewField = { ...dimension('channel'), sortType: 'alphabetical', sort: 'descending' };
    const sales: IViewField = {
        fid: 'sales', name: 'Sales', analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum', windowAgg: 'running_total',
    };
    const data = [
        { month: 'Jan', channel: 'Online', sales_sum: 6 },
        { month: 'Feb', channel: 'Online', sales_sum: 9 },
        { month: 'Mar', channel: 'Online', sales_sum: 2 },
        { month: 'Jan', channel: 'Retail', sales_sum: 10 },
        { month: 'Mar', channel: 'Retail', sales_sum: 3 },
    ];
    const { lt, tt, metric } = buildPivotTable([month], [channel], data, [], [], false, undefined, [sales]);
    expect(lt.children.map((node) => node.value)).toEqual(['Mar', 'Jan', 'Feb']);
    expect(tt.children.map((node) => node.value)).toEqual(['Retail', 'Online']);
    expect(metric.map((row) => row.map((cell) => cell?.sales_sum__window_running_total))).toEqual([[13, 17], [10, 15], [undefined, 9]]);
    expect(data[0]).toEqual({ month: 'Jan', channel: 'Online', sales_sum: 6 });
});

test('computes a running total for a window with no dimensions', () => {
    const sales: IViewField = {
        fid: 'sales', name: 'Sales', analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum', windowAgg: 'running_total',
    };
    const { metric } = buildPivotTable([], [], [{ sales_sum: 30 }], [], [], false, undefined, [sales]);
    expect(metric[0][0]?.sales_sum__window_running_total).toBe(30);
});

test('uses Vega ascending ordering for case-sensitive dimension values', () => {
    const sales: IViewField = {
        fid: 'sales', name: 'Sales', analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum', windowAgg: 'running_total',
    };
    const { metric } = buildPivotTable(
        [dimension('group')], [], [{ group: 'b', sales_sum: 10 }, { group: 'A', sales_sum: 20 }, { group: 'a', sales_sum: 30 }],
        [], [], false, undefined, [sales]
    );
    expect(Object.fromEntries(metric.map(([cell]) => [cell?.group, cell?.sales_sum__window_running_total]))).toEqual({ A: 20, a: 50, b: 60 });
});

test('uses the immediate previous row for difference and growth rate when the aggregate is null', () => {
    const sales: IViewField = {
        fid: 'sales', name: 'Sales', analyticType: 'measure', semanticType: 'quantitative', aggName: 'min', windowAgg: 'difference',
    };
    const { metric } = buildPivotTable(
        [dimension('group')], [], [{ group: 'a', sales_min: 10 }, { group: 'b', sales_min: null }, { group: 'c', sales_min: 30 }],
        [], [], false, undefined, [sales, { ...sales, windowAgg: 'growth_rate' }]
    );
    expect(metric.map(([cell]) => [cell?.sales_min__window_difference, cell?.sales_min__window_growth_rate])).toEqual([
        [null, null], [null, null], [null, null],
    ]);
});
