import assert from 'node:assert/strict';
import test from 'node:test';
import { axisLeafKey, pathKey, toTypedValue, typedValueKey } from '../src/core/keys';
import { createPreparedDataSource, PreparedDataError } from '../src/core/prepared';
import type { PreparedRecord, ReadVersion, RenderPlan, ResultBinding } from '../src/core/types';

const version: ReadVersion = { sourceId: 'fixture', snapshotId: 'snapshot-1', presentationId: 'presentation-1' };
const signal = () => new AbortController().signal;
const binding = (fieldRef: string, type: 'band' | 'linear' | 'time' = 'band'): ResultBinding => ({
    bindingId: fieldRef, fieldRef, columnKey: fieldRef, label: fieldRef,
    valueType: type === 'band' ? 'string' : type === 'time' ? 'time' : 'number', positionType: type,
});
const plan = (overrides: Partial<RenderPlan> = {}): RenderPlan => ({
    bindings: [binding('region'), binding('category'), binding('year'), binding('subcategory'), binding('sales', 'linear'), binding('profit', 'linear')],
    rows: { facets: ['region', 'category'], positions: ['subcategory'] },
    columns: { facets: ['year'], positions: ['sales', 'profit'] },
    mark: 'bar', domainPlanKey: 'bar-none', stack: 'none', ...overrides,
});

test('actual nested members, measure slots, and cross-axis empty coverage preserve records', async () => {
    const records = [
        { id: 'east-chair', region: 'East', category: 'Furniture', subcategory: 'Chair', year: '2024', sales: 12, profit: 3 },
        { id: 'west-paper', region: 'West', category: 'Office', subcategory: 'Paper', year: '2025', sales: 22, profit: -4 },
    ];
    const source = createPreparedDataSource({ version, plan: plan(), records, getDatumKey: (record) => String(record.id) });
    const description = await source.describe(signal());
    assert.equal(description.rowLeafCount, 2);
    assert.equal(description.columnLeafCount, 4);
    assert.equal(description.nonEmptyPaneCount, 4);
    assert.equal(description.identityScope, 'stable');
    const rows = await source.readAxis({ version, axis: 'row', range: { start: 0, end: 2 } }, signal());
    assert.deepEqual(rows.leaves.map((leaf) => leaf.path.map((member) => member.value)), [
        [toTypedValue('East'), toTypedValue('Furniture')], [toTypedValue('West'), toTypedValue('Office')],
    ]);
    const window = { rows: { start: 0, end: 2 }, columns: { start: 0, end: 4 } };
    const batch = await source.readPaneData({ version, windows: [window] }, signal());
    assert.deepEqual(batch.coveredWindows, [window]);
    assert.deepEqual(batch.panes.map((pane) => [pane.rowRank, pane.columnRank]), [[0, 0], [0, 1], [1, 2], [1, 3]]);
    assert.equal(batch.panes[0].records[0].values.sales, 12);
    assert.equal(batch.panes[1].records[0].datumKey, 'east-chair');
    assert.equal(batch.panes.some((pane) => pane.rowRank === 0 && pane.columnRank === 2), false);
});

test('U1 builds 24 panes with band inside the pane and two measure slots', async () => {
    const records: PreparedRecord[] = [];
    for (const region of ['East', 'West']) for (const category of ['A', 'B', 'C']) for (const year of ['2024', '2025']) for (const subcategory of ['one', 'two']) {
        records.push({ region, category, year, subcategory, sales: records.length + 1, profit: -records.length });
    }
    const source = createPreparedDataSource({ version, plan: plan(), records });
    const manifest = await source.describe(signal());
    assert.equal(manifest.rowLeafCount, 6);
    assert.equal(manifest.columnLeafCount, 4);
    assert.equal(manifest.nonEmptyPaneCount, 24);
    const batch = await source.readPaneData({ version, windows: [{ rows: { start: 0, end: 6 }, columns: { start: 0, end: 4 } }] }, signal());
    assert.equal(batch.panes.length, 24);
    assert.equal(batch.panes.flatMap((pane) => pane.records).length, 48);
    assert.ok(batch.panes.every((pane) => pane.records.length === 2));
    const domains = await source.readDomains({ version, fieldRefs: ['sales', 'profit', 'subcategory'] }, signal());
    assert.deepEqual(domains.domains.sales.values, [1, 24]);
    assert.deepEqual(domains.domains.profit.values, [-23, -0]);
    assert.deepEqual(domains.domains.subcategory.values, ['one', 'two']);
});

test('typed keys distinguish null, strings, numbers, booleans, times, intervals, and delimiters', () => {
    const values = [null, 'null', 1, '1', true, 'true', 'a|b', 'a,b', 'a"b'];
    assert.equal(new Set(values.map((value) => typedValueKey(toTypedValue(value)))).size, values.length);
    assert.notEqual(typedValueKey(toTypedValue(1)), typedValueKey(toTypedValue(1, 'time')));
    assert.notEqual(typedValueKey(toTypedValue([1, 2], 'interval')), typedValueKey(toTypedValue('[1,2]')));
    assert.equal(typedValueKey(toTypedValue(-0)), typedValueKey(toTypedValue(0)));
    const left = [{ fieldRef: 'parent', value: toTypedValue('East') }, { fieldRef: 'child', value: toTypedValue('Chair') }];
    const right = [{ fieldRef: 'parent', value: toTypedValue('West') }, { fieldRef: 'child', value: toTypedValue('Chair') }];
    assert.notEqual(pathKey(left), pathKey(right));
    assert.notEqual(axisLeafKey('row', left, 'a'), axisLeafKey('row', left, 'b'));
    assert.throws(() => toTypedValue(undefined), TypeError);
    assert.throws(() => toTypedValue(Infinity), TypeError);
});

test('explicit per-parent member ordering changes rank but preserves leaf and datum identity', async () => {
    const records = [{ id: 'a', region: 'East', sales: 4 }, { id: 'b', region: 'West', sales: 5 }];
    const renderPlan = plan({ bindings: [binding('region'), binding('sales', 'linear')], rows: { facets: ['region'], positions: [] }, columns: { facets: [], positions: ['sales'] }, mark: 'point' });
    const first = createPreparedDataSource({ version, plan: renderPlan, records, getDatumKey: (record) => String(record.id) });
    const nextVersion = { ...version, presentationId: 'presentation-2' };
    const second = createPreparedDataSource({ version: nextVersion, plan: renderPlan, records: [...records].reverse(), getDatumKey: (record) => String(record.id), memberOrder: [{ axis: 'row', parent: [], fieldRef: 'region', values: [toTypedValue('West'), toTypedValue('East')] }] });
    const axis = await first.readAxis({ version, axis: 'row', range: { start: 0, end: 2 } }, signal());
    const location = await second.locate({ version: nextVersion, axis: 'row', key: axis.leaves[0].key, path: axis.leaves[0].path }, signal());
    assert.equal(location.status, 'found');
    if (location.status === 'found') assert.equal(location.rank, 1);
    const batch = await second.readPaneData({ version: nextVersion, windows: [{ rows: { start: 1, end: 2 }, columns: { start: 0, end: 1 } }] }, signal());
    assert.equal(batch.panes[0].records[0].datumKey, 'a');
    const missing = await second.locate({ version: nextVersion, axis: 'row', key: 'missing' }, signal());
    assert.equal(missing.status, 'missing');
});

test('deep headers retain offscreen ancestors and global half-open spans', async () => {
    const refs = Array.from({ length: 20 }, (_, index) => `level${index}`);
    const records = ['A', 'B', 'C'].map((leaf) => Object.fromEntries([...refs.map((ref, index) => [ref, index === 19 ? leaf : 'parent']), ['value', 3]]));
    const renderPlan = plan({ bindings: [...refs.map((ref) => binding(ref)), binding('value', 'linear')], rows: { facets: refs, positions: [] }, columns: { facets: [], positions: ['value'] }, mark: 'point' });
    const source = createPreparedDataSource({ version, plan: renderPlan, records });
    const window = await source.readAxis({ version, axis: 'row', range: { start: 1, end: 2 } }, signal());
    assert.equal(window.leaves.length, 1);
    assert.equal(window.ancestors.length, 20);
    assert.deepEqual(window.ancestors[0] && [window.ancestors[0].start, window.ancestors[0].end], [0, 3]);
    assert.equal(window.ancestors[19].label, 'B');
});

test('one million logical cross slots produce only one thousand indexed panes', async () => {
    const records = Array.from({ length: 1000 }, (_, index) => ({ row: `r${index}`, column: `c${index}`, value: index }));
    const renderPlan = plan({ bindings: [binding('row'), binding('column'), binding('value', 'linear')], rows: { facets: ['row'], positions: [] }, columns: { facets: ['column'], positions: ['value'] }, mark: 'point' });
    const source = createPreparedDataSource({ version, plan: renderPlan, records });
    const manifest = await source.describe(signal());
    assert.equal(manifest.rowLeafCount * manifest.columnLeafCount, 1_000_000);
    assert.equal(manifest.nonEmptyPaneCount, 1000);
    const batch = await source.readPaneData({ version, windows: [{ rows: { start: 999, end: 1000 }, columns: { start: 998, end: 1000 } }] }, signal());
    assert.equal(batch.panes.length, 1);
    assert.equal(batch.panes[0].records[0].values.value, 999);
    const domain = await source.readDomains({ version, fieldRefs: ['value'] }, signal());
    assert.deepEqual(domain.domains.value.values, [0, 999]);
});

test('shared domains stay complete after small reads; explicit fixed domains preserve supplied endpoints', async () => {
    const renderPlan = plan({ bindings: [binding('x', 'time'), binding('y', 'linear')], rows: { facets: [], positions: ['y'] }, columns: { facets: [], positions: ['x'] }, mark: 'point', scales: { y: { domain: [-10, 30] } } });
    const records = [{ x: 0, y: 4 }, { x: 86_400_000, y: 12 }];
    const source = createPreparedDataSource({ version, plan: renderPlan, records });
    const first = await source.readDomains({ version, fieldRefs: ['x', 'y'] }, signal());
    await source.readPaneData({ version, windows: [] }, signal());
    const second = await source.readDomains({ version, fieldRefs: ['x', 'y'] }, signal());
    assert.deepEqual(first, second);
    assert.deepEqual(first.domains.x.values, [0, 86_400_000]);
    assert.deepEqual(first.domains.y.values, [-10, 30]);
    assert.equal(first.domains.y.source, 'fixed');
});

test('shared stacked domains cover positive and negative endpoints within each pane and position', async () => {
    const renderPlan = plan({ bindings: [binding('region'), binding('category'), binding('value', 'linear')],
        rows: { facets: ['region'], positions: ['value'] }, columns: { facets: [], positions: ['category'] }, stack: 'zero', barOrientation: 'vertical' });
    const records = [{ region: 'A', category: 'one', value: 5 }, { region: 'A', category: 'one', value: 7 },
        { region: 'A', category: 'one', value: -4 }, { region: 'A', category: 'one', value: -6 },
        { region: 'A', category: 'two', value: 3 }, { region: 'B', category: 'one', value: 9 }];
    const source = createPreparedDataSource({ version, plan: renderPlan, records });
    const domains = await source.readDomains({ version, fieldRefs: ['value', 'category'] }, signal());
    assert.deepEqual(domains.domains.value.values, [-10, 12]);
    assert.equal(domains.domains.value.extentKind, 'stacked');
    assert.equal(domains.domains.category.extentKind, 'value');
    const pane = await source.readPaneData({ version, windows: [{ rows: { start: 1, end: 2 }, columns: { start: 0, end: 1 } }] }, signal());
    assert.equal(pane.panes[0].records[0].values.value, 9);
    assert.deepEqual((await source.readDomains({ version, fieldRefs: ['value'] }, signal())).domains.value.values, [-10, 12]);
});

test('empty complete input and incomplete preview have different coverage and domain status', async () => {
    const renderPlan = plan({ bindings: [binding('value', 'linear')], rows: { facets: [], positions: [] }, columns: { facets: [], positions: ['value'] }, mark: 'point' });
    const empty = createPreparedDataSource({ version, plan: renderPlan, records: [] });
    const preview = createPreparedDataSource({ version, plan: renderPlan, records: [{ value: 3 }], complete: false });
    const windows = [{ rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } }];
    const emptyBatch = await empty.readPaneData({ version, windows }, signal());
    assert.deepEqual(emptyBatch.coveredWindows, windows);
    assert.deepEqual(emptyBatch.panes, []);
    const emptyDomains = await empty.readDomains({ version, fieldRefs: ['value'] }, signal());
    assert.deepEqual(emptyDomains.domains.value.values, [0, 1]);
    assert.equal(emptyDomains.domains.value.empty, true);
    const previewBatch = await preview.readPaneData({ version, windows }, signal());
    assert.deepEqual(previewBatch.coveredWindows, []);
    assert.equal(previewBatch.panes[0].complete, false);
    const previewDomains = await preview.readDomains({ version, fieldRefs: ['value'] }, signal());
    assert.equal(previewDomains.domains.value.complete, false);
    assert.equal((await preview.describe(signal())).status, 'preview');
});

test('overlapping windows deduplicate panes and retain duplicate-valued records', async () => {
    const renderPlan = plan({ bindings: [binding('value', 'linear')], rows: { facets: [], positions: [] }, columns: { facets: [], positions: ['value'] }, mark: 'point' });
    const source = createPreparedDataSource({ version, plan: renderPlan, records: [{ value: 2 }, { value: 2 }] });
    const window = { rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } };
    const batch = await source.readPaneData({ version, windows: [window, window] }, signal());
    assert.equal(batch.panes.length, 1);
    assert.equal(batch.panes[0].records.length, 2);
    assert.notEqual(batch.panes[0].records[0].datumKey, batch.panes[0].records[1].datumKey);
    assert.equal((await source.describe(signal())).identityScope, 'snapshot');
});

test('host keys use original record identity and returned metadata cannot mutate the source snapshot', async () => {
    const renderPlan = plan({ bindings: [binding('value', 'linear')], rows: { facets: [], positions: [] }, columns: { facets: [], positions: ['value'] }, mark: 'point' });
    const original = { value: 2 };
    const identities = new WeakMap([[original, 'stable-id']]);
    const source = createPreparedDataSource({ version, plan: renderPlan, records: [original], getDatumKey: (record) => identities.get(record as typeof original)! });
    original.value = 100;
    const batch = await source.readPaneData({ version, windows: [{ rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } }] }, signal());
    assert.equal(batch.panes[0].records[0].datumKey, 'stable-id');
    assert.equal(batch.panes[0].records[0].values.value, 2);
    assert.throws(() => createPreparedDataSource({ version, plan: renderPlan, records: [original], getDatumKey: () => undefined as unknown as string }), { code: 'unstable-datum-identity' });
});

test('read versions, cancellation, rank limits, missing bindings, and unsupported S0 modes fail explicitly', async () => {
    const renderPlan = plan({ bindings: [binding('value', 'linear')], rows: { facets: [], positions: [] }, columns: { facets: [], positions: ['value'] }, mark: 'point' });
    const source = createPreparedDataSource({ version, plan: renderPlan, records: [{ value: 2 }] });
    const expired = { ...version, snapshotId: 'old' };
    await assert.rejects(source.readDomains({ version: expired, fieldRefs: ['value'] }, signal()), { code: 'version-expired' });
    const controller = new AbortController(); controller.abort();
    await assert.rejects(source.describe(controller.signal), { name: 'AbortError' });
    await assert.rejects(source.readAxis({ version, axis: 'row', range: { start: -1, end: 1 } }, signal()), { code: 'source-contract-violation' });
    await assert.rejects(source.readPaneData({ version, windows: [], cursor: 'invented' }, signal()), { code: 'source-contract-violation' });
    await assert.rejects(source.readDomains({ version, fieldRefs: ['unknown'] }, signal()), { code: 'domain-unavailable' });
    assert.throws(() => createPreparedDataSource({ version, plan: renderPlan, records: [{}] }), { code: 'missing-binding' });
    assert.throws(() => createPreparedDataSource({ version, plan: renderPlan, records: [{ value: Infinity }] }), { code: 'invalid-value' });
    assert.throws(() => createPreparedDataSource({ version, plan: renderPlan, records: [{ value: 1 }], identityScope: 'stable' }), { code: 'unstable-datum-identity' });
    assert.throws(() => createPreparedDataSource({ version, plan: { ...renderPlan, mark: 'line' }, records: [] }), PreparedDataError);
    assert.throws(() => createPreparedDataSource({ version, plan: { ...renderPlan, scales: { value: { scope: { mode: 'pane' } } } }, records: [] }), { code: 'unsupported-encoding' });
});
