import type { IDataQueryPayload, IRow, IViewField } from '../../interfaces';
import { getComputation } from '../../computation/clientComputation';
import { buildPivotTable } from '../../workers/buildPivotTable';
import { MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { getPivotGroupByCombinations, queryPivotTable, type PivotTableModelBuilder } from './query';

jest.mock('../../services', () => {
    const { queryView } = jest.requireActual('../../lib/viewQuery') as typeof import('../../lib/viewQuery');
    const { sortBy } = jest.requireActual('../../lib/sort') as typeof import('../../lib/sort');
    return {
        applyFilter: async (data: IRow[]) => data,
        applySort: async (data: IRow[], by: string[], sort: 'ascending' | 'descending') => sortBy(data, by, sort),
        applyViewQuery: async (data: IRow[], query: Parameters<typeof queryView>[1]) => queryView(data, query),
        transformDataService: async (data: IRow[]) => data,
    };
});

const field = (fid: string, analyticType: IViewField['analyticType'], aggName?: string): IViewField => ({
    fid,
    name: fid,
    semanticType: analyticType === 'measure' ? 'quantitative' : 'nominal',
    analyticType,
    aggName,
});

const region = field('region', 'dimension');
const city = field('city', 'dimension');
const year = field('year', 'dimension');
const sales = field('sales', 'measure', 'sum');
const fields = [region, city, year, sales];

const leafRows = [
    { region: 'East', city: 'Boston', year: '2024', sales_sum: 9 },
    { region: 'West', city: 'Seattle', year: '2024', sales_sum: 18 },
    { region: 'West', city: 'San Francisco', year: '2024', sales_sum: 12 },
];

const buildModel: PivotTableModelBuilder = async (...args) => buildPivotTable(...args);

function groupByOf(payload: IDataQueryPayload): string[] {
    const view = payload.workflow.find((step) => step.type === 'view');
    if (!view || view.type !== 'view' || view.query[0]?.op !== 'aggregate') {
        return [];
    }
    return view.query[0].groupBy;
}

describe('pivot table query orchestration', () => {
    test('plans every prefix combination needed for summaries', () => {
        const combinations = getPivotGroupByCombinations([region, city], [year], [], true);
        expect(combinations.map((combination) => combination.map((item) => item.fid))).toEqual([
            [],
            ['region'],
            ['region', 'city'],
            ['year'],
            ['year', 'region'],
        ]);
    });

    test('plans only the subtotal needed by a collapsed path', () => {
        const combinations = getPivotGroupByCombinations(
            [region, city],
            [year],
            [[{ key: 'region', value: 'West' }]],
            false
        );
        expect(combinations.map((combination) => combination.map((item) => item.fid))).toEqual([['year', 'region']]);
    });

    test('queries leaf and collapsed aggregate data through the supplied computation', async () => {
        const calls: IDataQueryPayload[] = [];
        const computation = async (payload: IDataQueryPayload): Promise<IRow[]> => {
            calls.push(payload);
            const groupBy = groupByOf(payload).join(',');
            if (groupBy === 'region,city,year') {
                return leafRows;
            }
            if (groupBy === 'year,region') {
                return [
                    { region: 'East', year: '2024', sales_sum: 9 },
                    { region: 'West', year: '2024', sales_sum: 30 },
                ];
            }
            throw new Error(`Unexpected group by: ${groupBy}`);
        };

        const result = await queryPivotTable(
            {
                computation,
                fields,
                rows: [region, city],
                columns: [year, sales],
                defaultAggregated: true,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [[{ key: 'region', value: 'West' }]],
            },
            buildModel
        );

        expect(calls.map(groupByOf)).toEqual([
            ['region', 'city', 'year'],
            ['year', 'region'],
        ]);
        expect(result.leftTree.children.find((node) => node.value === 'West')?.isCollapsed).toBe(true);
        expect(result.metric.map((row) => row[0]?.sales_sum)).toEqual([9, 30]);
    });

    test('uses precomputed view data without repeating the leaf query', async () => {
        const calls: IDataQueryPayload[] = [];
        const computation = async (payload: IDataQueryPayload): Promise<IRow[]> => {
            calls.push(payload);
            return [
                { region: 'East', year: '2024', sales_sum: 9 },
                { region: 'West', year: '2024', sales_sum: 30 },
            ];
        };

        const result = await queryPivotTable(
            {
                computation,
                fields,
                rows: [region, city],
                columns: [year, sales],
                defaultAggregated: true,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [[{ key: 'region', value: 'West' }]],
                viewData: leafRows,
            },
            buildModel
        );

        expect(calls.map(groupByOf)).toEqual([['year', 'region']]);
        expect(result.metric.map((row) => row[0]?.sales_sum)).toEqual([9, 30]);
    });

    test('propagates computation failures to the component boundary', async () => {
        await expect(
            queryPivotTable(
                {
                    computation: async () => {
                        throw new Error('remote failed');
                    },
                    fields,
                    rows: [region, city],
                    columns: [year, sales],
                    defaultAggregated: true,
                    limit: -1,
                    showTableSummary: false,
                    collapsedPaths: [],
                },
                buildModel
            )
        ).rejects.toThrow('remote failed');
    });

    test('propagates model-builder failures to the component boundary', async () => {
        await expect(
            queryPivotTable(
                {
                    computation: async () => leafRows,
                    fields,
                    rows: [region, city],
                    columns: [year, sales],
                    defaultAggregated: true,
                    limit: -1,
                    showTableSummary: false,
                    collapsedPaths: [],
                },
                async () => {
                    throw new Error('worker failed');
                }
            )
        ).rejects.toThrow('worker failed');
    });

    test('honors descending dimension sorting without requiring a measure', async () => {
        const sortedRegion = { ...region, sort: 'descending' as const };
        const result = await queryPivotTable(
            {
                computation: async () => [
                    { region: 'East' },
                    { region: 'West' },
                ],
                fields: [region],
                rows: [sortedRegion],
                columns: [],
                defaultAggregated: true,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(result.leftTree.children.map((node) => node.value)).toEqual(['West', 'East']);
    });

    test('builds a pivot model from raw browser data through the built-in computation', async () => {
        const product = field('product', 'dimension');
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'East', product: 'Notebook', sales: 5 },
                    { region: 'East', product: 'Notebook', sales: 7 },
                    { region: 'East', product: 'Phone', sales: 11 },
                    { region: 'West', product: 'Notebook', sales: 13 },
                ]),
                fields: [region, product, sales],
                rows: [region],
                columns: [product, sales],
                defaultAggregated: true,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(result.leftTree.children.map((node) => node.value)).toEqual(['East', 'West']);
        expect(result.topTree.children.map((node) => node.value)).toEqual(['Notebook', 'Phone']);
        expect(result.metric.map((row) => row.map((cell) => cell?.sales_sum ?? null))).toEqual([
            [12, 11],
            [13, null],
        ]);
    });

    test('builds non-aggregated cells from raw measure keys', async () => {
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'East', sales: 9 },
                    { region: 'West', sales: 30 },
                ]),
                fields: [region, sales],
                rows: [region],
                columns: [sales],
                defaultAggregated: false,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(result.metric.map((row) => row[0]?.sales)).toEqual([9, 30]);
    });

    test('sorts raw-mode dimensions by the unaggregated measure key', async () => {
        const sortedRegion = { ...region, sort: 'descending' as const };
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'East', sales: 9 },
                    { region: 'West', sales: 30 },
                ]),
                fields: [region, sales],
                rows: [sortedRegion],
                columns: [sales],
                defaultAggregated: false,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(result.leftTree.children.map((node) => node.value)).toEqual(['West', 'East']);
    });

    test('uses raw folded measure values when aggregation is disabled', async () => {
        const profit = field('profit', 'measure', 'sum');
        const measureKey = field(MEA_KEY_ID, 'dimension');
        const measureValue = field(MEA_VAL_ID, 'measure', 'sum');
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'East', sales: 9, profit: 3 },
                    { region: 'West', sales: 30, profit: 8 },
                ]),
                fields: [region, sales, profit],
                rows: [region],
                columns: [measureKey, measureValue],
                defaultAggregated: false,
                folds: ['sales', 'profit'],
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(result.topTree.children.map((node) => node.value)).toEqual(['profit', 'sales']);
        expect(result.metric.map((row) => row.map((cell) => cell?.[MEA_VAL_ID]))).toEqual([
            [3, 9],
            [8, 30],
        ]);
    });

    test('keeps raw mode at leaf granularity when collapse and summaries are requested', async () => {
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'West', city: 'Seattle', sales: 18 },
                    { region: 'West', city: 'San Francisco', sales: 12 },
                ]),
                fields: [region, city, sales],
                rows: [region, city],
                columns: [sales],
                defaultAggregated: false,
                limit: -1,
                showTableSummary: true,
                collapsedPaths: [[{ key: 'region', value: 'West' }]],
            },
            buildModel
        );

        const west = result.leftTree.children.find((node) => node.value === 'West');
        expect(west?.isCollapsed).toBe(false);
        expect(west?.children.every((node) => node.kind === 'value')).toBe(true);
        expect(result.leftTree.children.some((node) => node.kind === 'summary')).toBe(false);
        expect(result.metric.map((row) => row[0]?.sales).sort()).toEqual([12, 18]);
    });

    test('rejects duplicate raw records that would map to the same pivot cell', async () => {
        await expect(
            queryPivotTable(
                {
                    computation: getComputation([
                        { region: 'East', sales: 5 },
                        { region: 'East', sales: 7 },
                    ]),
                    fields: [region, sales],
                    rows: [region],
                    columns: [sales],
                    defaultAggregated: false,
                    limit: -1,
                    showTableSummary: false,
                    collapsedPaths: [],
                },
                buildModel
            )
        ).rejects.toThrow('requires each row/column dimension tuple to be unique');
    });

    test('rejects aggregated mode when a visible measure has no aggregation', async () => {
        const unaggregatedSales = { ...sales, aggName: undefined };
        await expect(
            queryPivotTable(
                {
                    computation: getComputation([{ region: 'West', city: 'Seattle', sales: 18 }]),
                    fields: [region, city, unaggregatedSales],
                    rows: [region, city],
                    columns: [unaggregatedSales],
                    defaultAggregated: true,
                    limit: -1,
                    showTableSummary: true,
                    collapsedPaths: [[{ key: 'region', value: 'West' }]],
                },
                buildModel
            )
        ).rejects.toThrow('aggregated mode requires aggName');
    });

    test('does not dispatch an invalid raw query when both shelves are empty', async () => {
        const computation = jest.fn(async () => {
            throw new Error('empty query should not be dispatched');
        });
        const result = await queryPivotTable(
            {
                computation,
                fields,
                rows: [],
                columns: [],
                defaultAggregated: true,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(computation).not.toHaveBeenCalled();
        expect(result.leftTree.children).toEqual([]);
        expect(result.topTree.children).toEqual([]);
        expect(result.metric).toEqual([[undefined]]);
        expect(result.isEmpty).toBe(true);
    });

    test('sorts dimension-only data before applying a positive limit', async () => {
        const calls: IDataQueryPayload[] = [];
        const localComputation = getComputation([
            { region: 'East', year: '2025' },
            { region: 'West', year: '2024' },
        ]);
        const sortedRegion = { ...region, sort: 'descending' as const };
        const result = await queryPivotTable(
            {
                computation: async (payload) => {
                    calls.push(payload);
                    return localComputation(payload);
                },
                fields: [region, year],
                rows: [sortedRegion],
                columns: [year],
                defaultAggregated: true,
                limit: 1,
                showTableSummary: false,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(calls[0].workflow.find((step) => step.type === 'sort')).toEqual({
            type: 'sort',
            by: ['region'],
            sort: 'descending',
        });
        expect(result.leftTree.children.map((node) => node.value)).toEqual(['West']);
    });

    test('does not independently limit summary queries needed by the visible leaf rows', async () => {
        const sortedCity = { ...city, sort: 'descending' as const };
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'A', city: 'Only', sales: 100 },
                    { region: 'B', city: 'One', sales: 60 },
                    { region: 'B', city: 'Two', sales: 60 },
                ]),
                fields: [region, city, sales],
                rows: [region, sortedCity],
                columns: [sales],
                defaultAggregated: true,
                limit: 1,
                showTableSummary: true,
                collapsedPaths: [],
            },
            buildModel
        );

        expect(result.leftTree.children.filter((node) => node.kind === 'value').map((node) => node.value)).toEqual(['A']);
        expect(result.metric.flat().some((cell) => cell?.region === 'A' && cell.city === undefined && cell.sales_sum === 100)).toBe(true);
    });

    test('sorts by the visible subtotal when the opposite hierarchy is collapsed', async () => {
        const product = field('product', 'dimension');
        const sortedRegion = { ...region, sort: 'descending' as const };
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'A', year: '2024', product: 'One', sales: 100 },
                    { region: 'B', year: '2024', product: 'One', sales: 60 },
                    { region: 'B', year: '2024', product: 'Two', sales: 60 },
                ]),
                fields: [region, year, product, sales],
                rows: [sortedRegion],
                columns: [year, product, sales],
                defaultAggregated: true,
                limit: -1,
                showTableSummary: false,
                collapsedPaths: [[{ key: 'year', value: '2024' }]],
            },
            buildModel
        );

        expect(result.leftTree.children.map((node) => node.value)).toEqual(['B', 'A']);
        expect(result.metric.map((row) => row[0]?.sales_sum)).toEqual([120, 100]);
    });

    test('does not reintroduce rows excluded by the leaf limit when sorting a collapsed subtotal', async () => {
        const product = field('product', 'dimension');
        const sortedRegion = { ...region, sort: 'descending' as const };
        const result = await queryPivotTable(
            {
                computation: getComputation([
                    { region: 'A', year: '2024', product: 'One', sales: 100 },
                    { region: 'B', year: '2024', product: 'One', sales: 60 },
                    { region: 'B', year: '2024', product: 'Two', sales: 60 },
                    { region: 'C', year: '2024', product: 'One', sales: 40 },
                ]),
                fields: [region, year, product, sales],
                rows: [sortedRegion],
                columns: [year, product, sales],
                defaultAggregated: true,
                limit: 1,
                showTableSummary: false,
                collapsedPaths: [[{ key: 'year', value: '2024' }]],
            },
            buildModel
        );

        expect(result.leftTree.children.map((node) => node.value)).toEqual(['A']);
        expect(result.metric.map((row) => row[0]?.sales_sum)).toEqual([100]);
    });
});

test('computes separate windows for repeated shelf measures after one base aggregate query', async () => {
    const rows = [region, { ...sales, windowAgg: 'running_total' as const }, { ...sales, windowAgg: 'rank' as const }];
    const result = await queryPivotTable(
        {
            computation: getComputation([{ region: 'East', sales: 10 }, { region: 'West', sales: 7 }]),
            fields: [region, sales],
            rows,
            columns: [],
            defaultAggregated: true,
            limit: -1,
            showTableSummary: false,
            collapsedPaths: [],
        },
        buildModel
    );
    expect(result.metric.map(([cell]) => [cell?.sales_sum__window_running_total, cell?.sales_sum__window_rank])).toEqual([[10, 1], [17, 2]]);
});
