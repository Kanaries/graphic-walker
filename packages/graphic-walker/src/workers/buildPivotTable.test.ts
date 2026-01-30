import { buildPivotTable } from './buildPivotTable';
import { getMeaAggKey } from '../utils';
import { IViewField, IRow } from '../interfaces';

const createDimension = (fid: string, name: string, semanticType: IViewField['semanticType']): IViewField => ({
    fid,
    name,
    semanticType,
    analyticType: 'dimension',
});

const createMeasure = (fid: string, windowAgg: IViewField['windowAgg']): IViewField => ({
    fid,
    name: fid,
    semanticType: 'quantitative',
    analyticType: 'measure',
    aggName: 'sum',
    windowAgg,
});

describe('buildPivotTable', () => {
    test('computes window aggregations for pivot table cells', () => {
        const dimsInRow = [createDimension('month', 'Month', 'ordinal')];
        const dimsInColumn = [createDimension('category', 'Category', 'nominal')];
        const measures = [createMeasure('value', 'rank'), createMeasure('value', 'running_total')];

        const baseKey = getMeaAggKey('value', 'sum');
        const rankKey = getMeaAggKey('value', 'sum', 'rank');
        const runningTotalKey = getMeaAggKey('value', 'sum', 'running_total');

        const allData: IRow[] = [
            { month: 1, category: 'A', [baseKey]: 10 },
            { month: 2, category: 'A', [baseKey]: 20 },
            { month: 3, category: 'A', [baseKey]: 15 },
            { month: 1, category: 'B', [baseKey]: 5 },
            { month: 2, category: 'B', [baseKey]: 7 },
        ];

        const { lt, tt, metric } = buildPivotTable(dimsInRow, dimsInColumn, measures, allData, [], [], false);

        const rowIndex = (value: number) => lt.children.findIndex((node) => node.value === value);
        const colIndex = (value: string) => tt.children.findIndex((node) => node.value === value);

        const cell = (month: number, category: string) => {
            const row = metric[rowIndex(month)];
            return (row ? row[colIndex(category)] : undefined) as IRow | undefined;
        };

        expect(cell(1, 'A')?.[rankKey]).toBe(1);
        expect(cell(2, 'A')?.[rankKey]).toBe(2);
        expect(cell(3, 'A')?.[rankKey]).toBe(3);
        expect(cell(1, 'B')?.[rankKey]).toBe(1);
        expect(cell(2, 'B')?.[rankKey]).toBe(2);

        expect(cell(1, 'A')?.[runningTotalKey]).toBe(10);
        expect(cell(2, 'A')?.[runningTotalKey]).toBe(30);
        expect(cell(3, 'A')?.[runningTotalKey]).toBe(45);
        expect(cell(1, 'B')?.[runningTotalKey]).toBe(5);
        expect(cell(2, 'B')?.[runningTotalKey]).toBe(12);
    });
});