import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStackEndpoints } from '../src/core/stack';
import { createPreparedDataSource } from '../src/core/prepared';
import { domainRequestForWindow, getDisplayDomain } from '../src/core/domains';
import { assertCompleteWindow } from '../src/core/validateWindow';
import { assertRenderCapabilities } from '../src/core/capabilities';
import type { PaneRecord, PreparedRecord, RenderPlan, ResultBinding } from '../src/core/types';

const binding = (fieldRef: string, band = false): ResultBinding => ({ fieldRef, bindingId: fieldRef, columnKey: fieldRef, label: fieldRef, valueType: band ? 'string' : 'number', positionType: band ? 'band' : 'linear' });
const y = binding('y'), x = binding('x', true), region = binding('region', true), color = binding('color', true);
const makePlan = (overrides: Partial<RenderPlan> = {}): RenderPlan => ({ bindings: [x, y, region, color], mark: 'bar', barOrientation: 'vertical', stack: 'normalize',
    rows: { facets: ['region'], positions: ['y'] }, columns: { facets: [], positions: ['x'] }, channels: { color: { fieldRef: 'color' } }, domainPlanKey: 's4-contracts', ...overrides });
const record = (id: string, x: string, y: number | null, ordinal: number, seriesOrdinal = 0): PaneRecord => ({ datumKey: id, values: { x, y }, ordinal, seriesOrdinal });

test('normalized stacks use magnitudes, keep raw signs, and define all-zero groups', () => {
    const records = [record('negative', 'A', -2, 0, 1), record('positive', 'A', 6, 1), record('zero', 'B', 0, 2), record('missing', 'B', null, 3)];
    const endpoints = computeStackEndpoints(records, y, x, 'normalize');
    assert.deepEqual(endpoints.get('positive'), { start: 0, end: 0.75 });
    assert.deepEqual(endpoints.get('negative'), { start: 0.75, end: 1 });
    assert.deepEqual(endpoints.get('zero'), { start: 0, end: 0 });
    assert.equal(endpoints.has('missing'), false);
    assert.equal(records[0].values.y, -2);
});

test('center stacks use the complete pane maximum, preserve series order and reject overflow', () => {
    const endpoints = computeStackEndpoints([record('a', 'A', 3, 0), record('b', 'A', -7, 1, 1), record('c', 'B', 2, 2)], y, x, 'center');
    assert.deepEqual(endpoints.get('a'), { start: 0, end: 3 });
    assert.deepEqual(endpoints.get('b'), { start: 3, end: 10 });
    assert.deepEqual(endpoints.get('c'), { start: 4, end: 6 });
    for (const mode of ['zero', 'center', 'normalize'] as const)
        assert.throws(() => computeStackEndpoints([record('a', 'A', 1e308, 0), record('b', 'A', 1e308, 1)], y, x, mode), /finite/);
});

async function read(plan: RenderPlan, records: readonly PreparedRecord[]) {
    assertRenderCapabilities(plan);
    const version = { sourceId: 's4', snapshotId: '1', presentationId: '1' };
    const source = createPreparedDataSource({ plan, version, records, getDatumKey: row => String(row.id) });
    const signal = new AbortController().signal;
    const manifest = await source.describe(signal), window = { rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } };
    const [rows, columns, panes] = await Promise.all([source.readAxis({ version, axis: 'row', range: window.rows }, signal), source.readAxis({ version, axis: 'column', range: window.columns }, signal), source.readPaneData({ version, windows: [window] }, signal)]);
    const domains = await source.readDomains(domainRequestForWindow(plan, version, rows.leaves, columns.leaves), signal);
    const input = { plan, version, manifest, window, rows, columns, panes, domains };
    assertCompleteWindow(input);
    return { ...input, source, signal };
}

for (const mark of ['bar', 'area'] as const) for (const stack of ['zero', 'normalize', 'center'] as const) {
    test(`${mark} ${stack} scoped domains use complete endpoint layout before window reads`, async () => {
        const plan = makePlan({ mark, stack, scales: { y: { scope: { mode: 'pane' } } } });
        const input = await read(plan, [
            { id: 'e1', region: 'East', x: 'A', y: 2, color: 'one' }, { id: 'e2', region: 'East', x: 'A', y: -6, color: 'two' },
            { id: 'e3', region: 'East', x: 'B', y: 4, color: 'one' }, { id: 'w1', region: 'West', x: 'A', y: 20, color: 'one' },
        ]);
        const row = input.rows.leaves[0], column = input.columns.leaves[0];
        const domain = getDisplayDomain(plan, 'y', 'y', input.domains, row, column)!;
        assert.deepEqual(domain.values, stack === 'zero' ? [-6, 4] : stack === 'normalize' ? [0, 1] : [0, 8]);
        assert.equal(domain.extentKind, 'stacked');
        const next = await input.source.readDomains(domainRequestForWindow(plan, input.version, [row], [column]), input.signal);
        assert.deepEqual(getDisplayDomain(plan, 'y', 'y', next, row, column), domain);
        const invalid = { ...input, domains: { ...input.domains, domains: Object.fromEntries(Object.entries(input.domains.domains).map(([key, value]) => [key, { ...value, extentKind: 'value' as const }])) } };
        assert.throws(() => assertCompleteWindow(invalid), /stacked rendering endpoints/);
    });
}

test('prepared boxplot roles require complete, ordered groups and preserve outlier identities', async () => {
    const plan = makePlan({ mark: 'boxplot', stack: 'none', boxplot: { groupKeyColumn: 'group', roleColumn: 'role' } });
    const rows = ['lower', 'q1', 'median', 'q3', 'upper', 'outlier'].map((role, index) => ({ id: role, region: 'East', x: 'A', color: 'one', group: 'group-a', role, y: [1, 2, 3, 4, 5, 20][index] }));
    const input = await read(plan, rows);
    assert.deepEqual(input.domains.domains.y.values, [1, 20]);
    assert.equal(input.panes.panes[0].records.at(-1)?.datumKey, 'outlier');
    await assert.rejects(() => read(plan, rows.filter(row => row.role !== 'median')), /all five/);
    await assert.rejects(() => read(plan, [...rows, { ...rows[1], id: 'duplicate' }]), /duplicate statistic/);
    await assert.rejects(() => read(plan, rows.map(row => row.role === 'q1' ? { ...row, y: 6 } : row)), /must be ordered/);
    await assert.rejects(() => read(plan, rows.map(row => row.role === 'outlier' ? { ...row, y: 3 } : row)), /outside/);
    await assert.rejects(() => read(plan, rows.map(row => row.role === 'median' ? { ...row, x: 'B' } : row)), /span categories/);
});


test('null boxplot statistics cannot impersonate another measure slot or an explicit empty group', async () => {
    const boxplot = { groupKeyColumn: 'group', roleColumn: 'role' };
    const base = makePlan({ mark: 'boxplot', stack: 'none', boxplot });
    const stats = ['lower', 'q1', 'median', 'q3', 'upper'].map((role, i) => ({ id: role, region: 'East', x: 'A', color: 'one', group: 'g', role, y: i + 1 }));
    await assert.rejects(() => read(base, stats.map(row => ({ ...row, y: null }))), /finite measure slot/);
    await assert.rejects(() => read(base, [{ ...stats[0], role: 'outlier', y: null }]), /finite measure slot/);
    assert.equal((await read(base, [{ ...stats[0], role: 'empty', y: null }])).manifest.rowLeafCount, 1);
    const multi = { ...base, bindings: [...base.bindings, binding('other')], rows: { ...base.rows, positions: ['y', 'other'] } };
    const projected = await read(multi, stats.map(row => ({ ...row, other: null })));
    assert.equal(projected.manifest.rowLeafCount, 2);
    await assert.rejects(() => read(multi, [{ ...stats[0], role: 'empty', y: null, other: 1 }]), /null measure values/);
});
