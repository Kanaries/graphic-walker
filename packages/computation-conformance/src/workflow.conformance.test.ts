import type { IDataQueryPayload, IRow, IViewField } from '../../graphic-walker/src/interfaces';
import { executeClient } from './clientExecutor';
import { executeDuckDB, type DuckDBExecuteOptions } from './duckdbExecutor';
import { expectRowsToConform } from './assertRows';
import { toWorkflow } from '../../graphic-walker/src/utils/workflow';

async function expectConformance(data: IRow[], payload: IDataQueryPayload, options: { ordered?: boolean; duckdb?: DuckDBExecuteOptions } = {}) {
    const clientRows = await executeClient(data, payload);
    const { rows: duckdbRows } = await executeDuckDB(data, payload, options.duckdb);
    expectRowsToConform(duckdbRows, clientRows, { ordered: options.ordered });
}

const baseRows: IRow[] = [
    { id: 1, category: 'alpha', segment: 'A', value: 1, value2: 10, ts: Date.UTC(2024, 0, 1, 1, 2, 3), nullable: null, 'field (quoted)': 5, 中文: '甲' },
    { id: 2, category: 'Beta', segment: 'A', value: 2, value2: 20, ts: Date.UTC(2024, 0, 2, 4, 5, 6), nullable: 2, 'field (quoted)': 6, 中文: '乙' },
    { id: 3, category: 'gamma', segment: 'B', value: 3, value2: null, ts: Date.UTC(2024, 0, 7, 7, 8, 9), nullable: null, 'field (quoted)': 7, 中文: '甲' },
    { id: 4, category: 'delta', segment: null, value: 4, value2: 40, ts: Date.UTC(2024, 0, 8, 10, 11, 12), nullable: 4, 'field (quoted)': 8, 中文: '丙' },
    { id: 5, category: 'ALPHA', segment: 'B', value: 5, value2: 50, ts: Date.UTC(2024, 1, 1, 13, 14, 15), nullable: null, 'field (quoted)': 9, 中文: '甲' },
];

describe('workflow computation conformance', () => {
    test('filter range handles inclusive boundaries and null failures', async () => {
        await expectConformance(baseRows, {
            workflow: [
                { type: 'filter', filters: [{ fid: 'nullable', rule: { type: 'range', value: [2, 4] } }] },
                { type: 'view', query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文'] }] },
            ],
        });
    });

    test('filter temporal range applies offset parsing', async () => {
        await expectConformance(baseRows, {
            workflow: [
                { type: 'filter', filters: [{ fid: 'ts', rule: { type: 'temporal range', value: [Date.UTC(2024, 0, 2), Date.UTC(2024, 0, 31)], offset: 0 } }] },
                { type: 'view', query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文'] }] },
            ],
        });
    });

    test('filter one-of and not-in compare mixed encoded values', async () => {
        await expectConformance(baseRows, {
            workflow: [
                {
                    type: 'filter',
                    filters: [
                        { fid: 'category', rule: { type: 'one of', value: ['alpha', 'gamma', 5] } },
                        { fid: 'segment', rule: { type: 'not in', value: ['Z'] } },
                    ],
                },
                { type: 'view', query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文'] }] },
            ],
        });
    });

    test('filter regexp supports case-insensitive search without anchors', async () => {
        await expectConformance(baseRows, {
            workflow: [
                { type: 'filter', filters: [{ fid: 'category', rule: { type: 'regexp', value: 'alp', caseSensitive: false } }] },
                { type: 'view', query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文'] }] },
            ],
        });
    });

    test('filter regexp anchors use JavaScript search semantics', async () => {
        await expectConformance(baseRows, {
            workflow: [
                { type: 'filter', filters: [{ fid: 'category', rule: { type: 'regexp', value: '^a', caseSensitive: false } }] },
                { type: 'view', query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文'] }] },
            ],
        });
    });

    test('transform bin produces interval tuples', async () => {
        await expectConformance(baseRows, {
            workflow: [
                {
                    type: 'transform',
                    transform: [{ key: 'value_bin', expression: { op: 'bin', as: 'value_bin', num: 2, params: [{ type: 'field', value: 'value' }] } }],
                },
                {
                    type: 'view',
                    query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文', 'value_bin'] }],
                },
            ],
        });
    });

    test.failing('DVG-002: transform binCount is quantile/rank bucketing', async () => {
        await expectConformance([{ value: 1 }, { value: 2 }, { value: 3 }, { value: 100 }, { value: 101 }, { value: 102 }], {
            workflow: [
                {
                    type: 'transform',
                    transform: [{ key: 'bucket', expression: { op: 'binCount', as: 'bucket', num: 3, params: [{ type: 'field', value: 'value' }] } }],
                },
                { type: 'view', query: [{ op: 'raw', fields: ['value', 'bucket'] }] },
            ],
        });
    });

    test('transform log family works for positive values', async () => {
        await expectConformance([{ value: 1 }, { value: 10 }, { value: 100 }], {
            workflow: [
                {
                    type: 'transform',
                    transform: [
                        { key: 'ln', expression: { op: 'log', as: 'ln', params: [{ type: 'field', value: 'value' }] } },
                        { key: 'log2', expression: { op: 'log2', as: 'log2', params: [{ type: 'field', value: 'value' }] } },
                        { key: 'log10', expression: { op: 'log10', as: 'log10', params: [{ type: 'field', value: 'value' }] } },
                    ],
                },
                { type: 'view', query: [{ op: 'raw', fields: ['value', 'ln', 'log2', 'log10'] }] },
            ],
        });
    });

    test.failing('DVG-001: transform log returns null for non-positive values', async () => {
        await expectConformance([{ value: 10 }, { value: 0 }, { value: -5 }], {
            workflow: [
                { type: 'transform', transform: [{ key: 'log10', expression: { op: 'log10', as: 'log10', params: [{ type: 'field', value: 'value' }] } }] },
                { type: 'view', query: [{ op: 'raw', fields: ['value', 'log10'] }] },
            ],
        });
    });

    test('transform expr evaluates row-wise', async () => {
        await expectConformance(baseRows, {
            workflow: [
                {
                    type: 'transform',
                    transform: [{ key: 'calc', expression: { op: 'expr', as: 'calc', params: [{ type: 'sql', value: 'value + "field (quoted)"' }] } }],
                },
                {
                    type: 'view',
                    query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文', 'calc'] }],
                },
            ],
        });
    });

    test.failing('DVG-005: transform one aliases its output field', async () => {
        await expectConformance([{ value: 1 }, { value: 2 }], {
            workflow: [
                { type: 'transform', transform: [{ key: 'one', expression: { op: 'one', as: 'one', params: [] } }] },
                { type: 'view', query: [{ op: 'raw', fields: ['value', 'one'] }] },
            ],
        });
    });

    test.each(['year', 'quarter', 'month', 'day', 'hour', 'minute', 'second'] as const)(
        'dateTimeDrill %s conforms with offset/displayOffset',
        async (level) => {
            await expectConformance(baseRows, {
                workflow: [
                    {
                        type: 'transform',
                        transform: [
                            {
                                key: level,
                                expression: {
                                    op: 'dateTimeDrill',
                                    as: level,
                                    params: [
                                        { type: 'field', value: 'ts' },
                                        { type: 'value', value: level },
                                        { type: 'offset', value: 0 },
                                        { type: 'displayOffset', value: 0 },
                                    ],
                                },
                            },
                        ],
                    },
                    {
                        type: 'view',
                        query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文', level] }],
                    },
                ],
            });
        },
    );

    test.failing('DVG-006: dateTimeDrill week is Sunday-start', async () => {
        await expectConformance(baseRows, {
            workflow: [
                {
                    type: 'transform',
                    transform: [
                        {
                            key: 'week',
                            expression: {
                                op: 'dateTimeDrill',
                                as: 'week',
                                params: [
                                    { type: 'field', value: 'ts' },
                                    { type: 'value', value: 'week' },
                                    { type: 'offset', value: 0 },
                                    { type: 'displayOffset', value: 0 },
                                ],
                            },
                        },
                    ],
                },
                {
                    type: 'view',
                    query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文', 'week'] }],
                },
            ],
        });
    });

    test.each(['year', 'quarter', 'month', 'weekday', 'day', 'hour', 'minute', 'second'] as const)('dateTimeFeature %s conforms', async (level) => {
        await expectConformance(baseRows, {
            workflow: [
                {
                    type: 'transform',
                    transform: [
                        {
                            key: level,
                            expression: {
                                op: 'dateTimeFeature',
                                as: level,
                                params: [
                                    { type: 'field', value: 'ts' },
                                    { type: 'value', value: level },
                                    { type: 'offset', value: 0 },
                                    { type: 'displayOffset', value: 0 },
                                ],
                            },
                        },
                    ],
                },
                {
                    type: 'view',
                    query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文', level] }],
                },
            ],
        });
    });

    test.failing('DVG-006: dateTimeFeature week uses Sunday-based week numbering', async () => {
        await expectConformance(baseRows, {
            workflow: [
                {
                    type: 'transform',
                    transform: [
                        {
                            key: 'week',
                            expression: {
                                op: 'dateTimeFeature',
                                as: 'week',
                                params: [
                                    { type: 'field', value: 'ts' },
                                    { type: 'value', value: 'week' },
                                    { type: 'offset', value: 0 },
                                    { type: 'displayOffset', value: 0 },
                                ],
                            },
                        },
                    ],
                },
                {
                    type: 'view',
                    query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文', 'week'] }],
                },
            ],
        });
    });

    test.failing.each(['iso_year', 'iso_week', 'iso_weekday'] as const)('DVG-007: dateTimeFeature %s uses ISO calendar semantics', async (level) => {
        await expectConformance([{ ts: Date.UTC(2021, 0, 1) }, { ts: Date.UTC(2021, 0, 4) }], {
            workflow: [
                {
                    type: 'transform',
                    transform: [
                        {
                            key: level,
                            expression: {
                                op: 'dateTimeFeature',
                                as: level,
                                params: [
                                    { type: 'field', value: 'ts' },
                                    { type: 'value', value: level },
                                    { type: 'offset', value: 0 },
                                    { type: 'displayOffset', value: 0 },
                                ],
                            },
                        },
                    ],
                },
                { type: 'view', query: [{ op: 'raw', fields: ['ts', level] }] },
            ],
        });
    });

    test('view aggregate covers all aggregators and null group keys', async () => {
        await expectConformance(
            baseRows,
            {
                workflow: [
                    {
                        type: 'view',
                        query: [
                            {
                                op: 'aggregate',
                                groupBy: ['segment'],
                                measures: [
                                    { field: 'value', agg: 'sum', asFieldKey: 'sum_value' },
                                    { field: 'value', agg: 'count', asFieldKey: 'count_value' },
                                    { field: 'value', agg: 'max', asFieldKey: 'max_value' },
                                    { field: 'value', agg: 'min', asFieldKey: 'min_value' },
                                    { field: 'value', agg: 'mean', asFieldKey: 'mean_value' },
                                    { field: 'value', agg: 'median', asFieldKey: 'median_value' },
                                    { field: 'nullable', agg: 'distinctCount', asFieldKey: 'distinct_nullable' },
                                    { field: 'sum(value) + count(value)', agg: 'expr', asFieldKey: 'expr_metric' },
                                ],
                            },
                        ],
                    },
                ],
            },
            { ordered: false },
        );
    });

    test.failing('DVG-009: variance and stdev use population formulas', async () => {
        await expectConformance(
            [
                { segment: 'A', value: 1 },
                { segment: 'A', value: 3 },
            ],
            {
                workflow: [
                    {
                        type: 'view',
                        query: [
                            {
                                op: 'aggregate',
                                groupBy: ['segment'],
                                measures: [
                                    { field: 'value', agg: 'variance', asFieldKey: 'variance_value' },
                                    { field: 'value', agg: 'stdev', asFieldKey: 'stdev_value' },
                                ],
                            },
                        ],
                    },
                ],
            },
        );
    });

    test('sort supports multiple keys with limit and offset at pipeline end', async () => {
        await expectConformance(
            [
                { id: 1, value: 2, tie: 2 },
                { id: 2, value: 1, tie: 3 },
                { id: 3, value: 1, tie: 1 },
                { id: 4, value: 3, tie: 1 },
            ],
            {
                workflow: [
                    { type: 'view', query: [{ op: 'raw', fields: ['id', 'value', 'tie'] }] },
                    { type: 'sort', by: ['value', 'tie'], sort: 'ascending' },
                ],
                limit: 2,
                offset: 1,
            },
        );
    });

    test.failing('DVG-010: sort uses explicit client null ordering', async () => {
        await expectConformance(baseRows, {
            workflow: [
                { type: 'view', query: [{ op: 'raw', fields: ['id', 'category', 'segment', 'value', 'value2', 'ts', 'nullable', 'field (quoted)', '中文'] }] },
                { type: 'sort', by: ['segment', 'value'], sort: 'ascending' },
            ],
        });
    });

    test('special-character fields survive SQL quoting', async () => {
        await expectConformance(
            [
                { 'quoted "field"': 'kept', 'number text': '1', 中文: '甲' },
                { 'quoted "field"': 'kept2', 'number text': '2', 中文: '乙' },
            ],
            {
                workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['quoted "field"', 'number text', '中文'] }] }],
            },
        );
    });

    test.failing('DVG-011: numeric strings coerce in expression arithmetic', async () => {
        await expectConformance([{ 'number text': '1' }, { 'number text': '2' }], {
            workflow: [
                {
                    type: 'transform',
                    transform: [{ key: 'plus_one', expression: { op: 'expr', as: 'plus_one', params: [{ type: 'sql', value: '"number text" + 1' }] } }],
                },
                { type: 'view', query: [{ op: 'raw', fields: ['number text', 'plus_one'] }] },
            ],
        });
    });

    test('empty dataset returns an empty raw result with explicit SQL schema', async () => {
        await expectConformance(
            [],
            { workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['value', 'category'] }] }] },
            { duckdb: { emptySchema: { value: 'DOUBLE', category: 'VARCHAR' } } },
        );
    });

    test('single-row aggregate works', async () => {
        await expectConformance([{ value: 7, category: 'solo' }], {
            workflow: [
                { type: 'view', query: [{ op: 'aggregate', groupBy: ['category'], measures: [{ field: 'value', agg: 'sum', asFieldKey: 'sum_value' }] }] },
            ],
        });
    });

    test('toWorkflow generated six-step style pipeline conforms for supported operators', async () => {
        const valueField: IViewField = { fid: 'value', name: 'value', semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' };
        const segmentField: IViewField = { fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' };
        const doubledField: IViewField = {
            fid: 'double_value',
            name: 'double value',
            semanticType: 'quantitative',
            analyticType: 'measure',
            computed: true,
            expression: { op: 'expr', as: 'double_value', params: [{ type: 'sql', value: 'value * 2' }] },
            aggName: 'sum',
        };
        const workflow = toWorkflow(
            [{ ...segmentField, rule: { type: 'not in', value: ['Z'] } }],
            [valueField, segmentField, doubledField],
            [segmentField],
            [doubledField],
            true,
            'descending',
            [],
            2,
            0,
        );
        await expectConformance(baseRows, { workflow, limit: 2 }, { ordered: false });
    });

    test('multiple view steps cascade sequentially', async () => {
        await expectConformance(
            baseRows,
            {
                workflow: [
                    { type: 'view', query: [{ op: 'aggregate', groupBy: ['segment'], measures: [{ field: 'value', agg: 'sum', asFieldKey: 'sum_value' }] }] },
                    { type: 'view', query: [{ op: 'aggregate', groupBy: [], measures: [{ field: 'sum_value', agg: 'sum', asFieldKey: 'grand_total' }] }] },
                ],
            },
            { ordered: false },
        );
    });

    test.skip('DVG-003: view fold is specified but unsupported by gw-dsl-parser', async () => {
        await expectConformance([{ id: 1, a: 10, b: 20 }], {
            workflow: [{ type: 'view', query: [{ op: 'fold', foldBy: ['a', 'b'], newFoldKeyCol: 'key', newFoldValueCol: 'value' }] }],
        });
    });

    test.skip('DVG-004: view bin is specified but unsupported by gw-dsl-parser', async () => {
        await expectConformance([{ value: 1 }, { value: 2 }, { value: 3 }], {
            workflow: [{ type: 'view', query: [{ op: 'bin', binBy: 'value', newBinCol: 'value_bin', binSize: 3 }] }],
        });
    });

    test.failing('DVG-008: raw view projects fields', async () => {
        await expectConformance([{ a: 1, b: 2 }], {
            workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['a'] }] }],
        });
    });
});
