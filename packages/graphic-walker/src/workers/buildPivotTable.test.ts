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
    expect(metric.map((row) => row.map((cell) => cell?.sales_sum__window_running_total))).toEqual([[3, 2], [13, 8], [undefined, 17]]);
    expect(data[0]).toEqual({ month: 'Jan', channel: 'Online', sales_sum: 6 });
});
