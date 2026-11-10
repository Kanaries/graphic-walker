import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet, executePlan } from '../src/compiler';
import { resultTables, tableToCSV } from '../src/export';
import { concat, field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, reference } from './helpers';

const instances = { ...fields(['region', 'product', 'segment'], { sum: ['value', 'sum'], count: ['value', 'count'] }),
    value: { id: 'value', field: 'value', label: 'Value', display: 'continuous' as const } };
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
const rows: Row[] = [
    { region: 'East', product: 'a, "large"', segment: 's', value: 3 }, { region: 'East', product: 'a, "large"', segment: 't', value: 4 },
    { region: 'West', product: 'b', segment: 's', value: 5 }, { region: 'West', product: 'c', segment: 's', value: null },
];
const tables = async (spec: WorksheetSpec) => { const plan = compileWorksheet(spec); return resultTables(plan, await executePlan(plan, reference(rows))); };

test('the exported table holds the records behind the marks, columns in shelf order', async () => {
    const [table, ...rest] = await tables({ ...base, rows: nest(field('region'), field('product')), columns: concat(field('sum'), field('count')), mark: 'bar', color: 'segment' });
    assert.equal(rest.length, 0);
    // Rows first, then the color dimension, then the measures; not the alphabetical order of the query.
    assert.deepEqual(table.columns, [{ key: 'region', label: 'region' }, { key: 'product', label: 'product' }, { key: 'segment', label: 'segment' }, { key: '__ws_sum', label: 'SUM' }, { key: '__ws_count', label: 'COUNT' }]);
    assert.equal(table.rows.length, 4);
    assert.equal(tableToCSV(table), ['region,product,segment,SUM,COUNT', 'East,"a, ""large""",s,3,1', 'East,"a, ""large""",t,4,1', 'West,b,s,5,1', 'West,c,s,,0'].join('\n'));
});
test('queries that only order members are not exported, and a limit shows in the table', async () => {
    const spec: WorksheetSpec = { ...base, rows: nest(field('region'), field('product')), columns: field('sum'), mark: 'bar', color: 'segment',
        order: { product: { by: 'sum', direction: 'descending' } }, limit: { rows: 2, by: 'sum', direction: 'descending' } };
    assert.equal(compileWorksheet(spec).tasks.length, 2);
    const [table, ...rest] = await tables(spec);
    assert.equal(rest.length, 0);
    assert.deepEqual(table.rows.map(r => r.__ws_sum), [5, 4]);
});
test('a box plot exports its source rows, duplicates included, and bins are written as their bounds', async () => {
    const [table] = await tables({ ...base, rows: field('value'), columns: field('region'), mark: 'boxplot' });
    // The dimension leads although the values are on rows.
    assert.deepEqual(table.columns.map(c => c.label), ['region', 'Value']);
    assert.equal(table.rows.length, 4);
    assert.equal(tableToCSV({ columns: [{ key: 'bin', label: 'bin' }, { key: 'when', label: 'when' }], rows: [{ bin: [0, 23.5], when: new Date(Date.UTC(2024, 0, 2)) }] }), 'bin,when\n0 – 23.5,2024-01-02T00:00:00.000Z');
});
