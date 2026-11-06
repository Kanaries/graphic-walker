import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedDataSource, PreparedDataError } from '../src/core/prepared';
import { assertCompleteWindow, type CompleteWindowInput } from '../src/core/validateWindow';
import type { RenderPlan } from '../src/core/types';

async function fixture(): Promise<CompleteWindowInput> {
    const version = { sourceId: 'window-fixture', snapshotId: 'data', presentationId: 'view' };
    const plan: RenderPlan = {
        bindings: ['region', 'year', 'category', 'value'].map((fieldRef) => ({ fieldRef, bindingId: fieldRef, columnKey: fieldRef, label: fieldRef,
            positionType: fieldRef === 'value' ? 'linear' : 'band', valueType: fieldRef === 'value' ? 'number' : 'string' })),
        rows: { facets: ['region'], positions: ['category'] }, columns: { facets: ['year'], positions: ['value'] },
        mark: 'bar', stack: 'zero', barOrientation: 'horizontal', domainPlanKey: 'bar-stack',
    };
    const source = createPreparedDataSource({ version, plan, records: [
        { id: 'first', region: 'East', year: '2024', category: 'A', value: 5 },
        { id: 'second', region: 'East', year: '2024', category: 'A', value: 7 },
        { id: 'third', region: 'West', year: '2025', category: 'B', value: -3 },
    ], getDatumKey: (record) => String(record.id) });
    const signal = new AbortController().signal;
    const window = { rows: { start: 0, end: 2 }, columns: { start: 0, end: 2 } };
    const [manifest, rows, columns, panes, domains] = await Promise.all([
        source.describe(signal), source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        source.readAxis({ version, axis: 'column', range: window.columns }, signal), source.readPaneData({ version, windows: [window] }, signal),
        source.readDomains({ version, fieldRefs: plan.bindings.map((binding) => binding.fieldRef) }, signal),
    ]);
    return { plan, version, window, manifest, rows, columns, panes, domains };
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };
const mutable = (input: CompleteWindowInput): Mutable<CompleteWindowInput> => structuredClone(input) as Mutable<CompleteWindowInput>;

test('complete sparse windows certify absent combinations as empty without creating pane records', async () => {
    const input = await fixture();
    assert.equal(input.panes.panes.length, 2);
    assert.doesNotThrow(() => assertCompleteWindow(input));
});

test('all response versions and manifest domain plans must match the requested presentation', async () => {
    const input = await fixture();
    for (const response of ['manifest', 'rows', 'columns', 'panes', 'domains'] as const) {
        const broken = mutable(input);
        broken[response].version.presentationId = 'old';
        assert.throws(() => assertCompleteWindow(broken), { code: 'version-expired' }, response);
    }
    const mismatched = mutable(input);
    mismatched.manifest.domainPlanKey = 'another-stack';
    assert.throws(() => assertCompleteWindow(mismatched), { code: 'source-contract-violation' });
});

test('partial axis responses, duplicate ranks and wrong requested ranges cannot commit', async () => {
    const input = await fixture();
    const missing = mutable(input); missing.rows.leaves.pop();
    assert.throws(() => assertCompleteWindow(missing), { code: 'incomplete-data' });
    const duplicateRank = mutable(input); duplicateRank.rows.leaves[1].rank = 0;
    assert.throws(() => assertCompleteWindow(duplicateRank), { code: 'source-contract-violation' });
    const range = mutable(input); range.rows.range.end = 1;
    assert.throws(() => assertCompleteWindow(range), { code: 'source-contract-violation' });
    const axis = mutable(input); axis.columns.axis = 'row';
    assert.throws(() => assertCompleteWindow(axis), { code: 'source-contract-violation' });
});

test('leaf keys, opaque positions and typed facet paths must agree with their ranks', async () => {
    const input = await fixture();
    const duplicateKey = mutable(input); duplicateKey.rows.leaves[1].key = duplicateKey.rows.leaves[0].key;
    assert.throws(() => assertCompleteWindow(duplicateKey), { code: 'source-contract-violation' });
    const unknownPosition = mutable(input); unknownPosition.rows.leaves[0].positionRef = 'unknown';
    assert.throws(() => assertCompleteWindow(unknownPosition), { code: 'source-contract-violation' });
    const badPath = mutable(input); badPath.rows.leaves[0].path[0].fieldRef = 'year';
    assert.throws(() => assertCompleteWindow(badPath), { code: 'source-contract-violation' });
    const forgedKey = mutable(input); forgedKey.rows.leaves[0].key = 'fabricated-leaf';
    assert.throws(() => assertCompleteWindow(forgedKey), { code: 'source-contract-violation' });
});

test('headers reject invalid depth, out-of-range spans, wrong ancestry and omitted ancestors', async () => {
    const input = await fixture();
    const depth = mutable(input); depth.rows.ancestors[0].depth = 20;
    assert.throws(() => assertCompleteWindow(depth), { code: 'source-contract-violation' });
    const span = mutable(input); span.rows.ancestors[0].end = 100;
    assert.throws(() => assertCompleteWindow(span), { code: 'source-contract-violation' });
    const crossed = mutable(input); crossed.rows.ancestors[0].end = 2;
    assert.throws(() => assertCompleteWindow(crossed), { code: 'source-contract-violation' });
    const missing = mutable(input); missing.rows.ancestors = [];
    assert.throws(() => assertCompleteWindow(missing), { code: 'incomplete-data' });
});

test('panes reject rank/key, slot, canonical pane key and member path mismatches', async () => {
    const input = await fixture();
    const key = mutable(input); key.panes.panes[0].rowKey = key.rows.leaves[1].key;
    assert.throws(() => assertCompleteWindow(key), { code: 'source-contract-violation' });
    const slot = mutable(input); slot.panes.panes[0].columnSlotId = 'wrong-slot';
    assert.throws(() => assertCompleteWindow(slot), { code: 'source-contract-violation' });
    const rank = mutable(input); rank.panes.panes[0].rowRank = 2;
    assert.throws(() => assertCompleteWindow(rank), { code: 'source-contract-violation' });
    const canonical = mutable(input); canonical.panes.panes[0].key = 'invented-pane';
    assert.throws(() => assertCompleteWindow(canonical), { code: 'source-contract-violation' });
    const path = mutable(input); path.panes.panes[0].rowPath = path.rows.leaves[1].path;
    assert.throws(() => assertCompleteWindow(path), { code: 'source-contract-violation' });
});

test('duplicate panes and duplicate datum identities within a pane cannot commit', async () => {
    const input = await fixture();
    const pane = mutable(input); pane.panes.panes.push(pane.panes.panes[0]);
    assert.throws(() => assertCompleteWindow(pane), { code: 'source-contract-violation' });
    const datum = mutable(input); datum.panes.panes[0].records.push(datum.panes.panes[0].records[0]);
    assert.throws(() => assertCompleteWindow(datum), { code: 'source-contract-violation' });
    const ordinal = mutable(input); ordinal.panes.panes[0].records[0].ordinal = NaN;
    assert.throws(() => assertCompleteWindow(ordinal), { code: 'source-contract-violation' });
});

test('missing coverage stays incomplete even when all returned panes are complete', async () => {
    const input = await fixture();
    const missing = mutable(input); missing.panes.coveredWindows = [];
    assert.throws(() => assertCompleteWindow(missing), { code: 'incomplete-data' });
    const gap = mutable(input);
    gap.panes.coveredWindows = [{ rows: { start: 0, end: 1 }, columns: { start: 0, end: 2 } }];
    assert.throws(() => assertCompleteWindow(gap), { code: 'incomplete-data' });
    const invalid = mutable(input); invalid.panes.coveredWindows[0].columns.end = 3;
    assert.throws(() => assertCompleteWindow(invalid), { code: 'source-contract-violation' });
});

test('coverage can be the union of adjacent rectangles including confirmed empty slots', async () => {
    const input = mutable(await fixture());
    input.panes.coveredWindows = [
        { rows: { start: 0, end: 2 }, columns: { start: 0, end: 1 } },
        { rows: { start: 0, end: 1 }, columns: { start: 1, end: 2 } },
        { rows: { start: 1, end: 2 }, columns: { start: 1, end: 2 } },
    ];
    assert.doesNotThrow(() => assertCompleteWindow(input));
});

test('preview manifests, partial panes, and pagination cursors produce explicit incompleteness', async () => {
    const input = await fixture();
    const preview = mutable(input); preview.manifest.status = 'preview';
    assert.throws(() => assertCompleteWindow(preview), { code: 'incomplete-data' });
    const pane = mutable(input); pane.panes.panes[0].complete = false;
    assert.throws(() => assertCompleteWindow(pane), { code: 'incomplete-data' });
    const cursor = mutable(input); cursor.panes.nextCursor = 'page-2';
    assert.throws(() => assertCompleteWindow(cursor), { code: 'incomplete-data' });
});

test('missing, incomplete and unavailable domains cannot silently become an empty scale', async () => {
    const input = await fixture();
    const missing = mutable(input); delete missing.domains.domains.value;
    assert.throws(() => assertCompleteWindow(missing), { code: 'domain-unavailable' });
    const incomplete = mutable(input); incomplete.domains.domains.value.complete = false;
    assert.throws(() => assertCompleteWindow(incomplete), { code: 'domain-unavailable' });
    const unavailable = mutable(input); unavailable.domains.domains.value.source = 'unavailable';
    assert.throws(() => assertCompleteWindow(unavailable), { code: 'domain-unavailable' });
});

test('stacked bars require stacked extent metadata, with explicit fixed and empty domain exceptions', async () => {
    const input = await fixture();
    const raw = mutable(input); raw.domains.domains.value.extentKind = 'value';
    assert.throws(() => assertCompleteWindow(raw), { code: 'domain-unavailable' });
    const fixed = mutable(raw); fixed.domains.domains.value.source = 'fixed';
    assert.doesNotThrow(() => assertCompleteWindow(fixed));
    const empty = mutable(raw); empty.domains.domains.value.empty = true;
    assert.doesNotThrow(() => assertCompleteWindow(empty));
    const emptyPanes = mutable(raw); emptyPanes.panes.panes = [];
    assert.doesNotThrow(() => assertCompleteWindow(emptyPanes));
});

test('invalid numeric endpoints and mismatched band domain identities cannot commit', async () => {
    const input = await fixture();
    const numeric = mutable(input); numeric.domains.domains.value.values = [-3, Infinity];
    assert.throws(() => assertCompleteWindow(numeric), { code: 'source-contract-violation' });
    const backwards = mutable(input); backwards.domains.domains.value.values = [12, -3];
    assert.throws(() => assertCompleteWindow(backwards), { code: 'source-contract-violation' });
    const category = mutable(input); category.domains.domains.category.values = ['A', 'A'];
    assert.throws(() => assertCompleteWindow(category), { code: 'source-contract-violation' });
    const identity = mutable(input); identity.rows.leaves[0].bandDomainId = 'other-domain';
    assert.throws(() => assertCompleteWindow(identity), { code: 'source-contract-violation' });
});

test('pane values reject missing columns, undefined, numeric strings and non-finite continuous coordinates', async () => {
    const input = await fixture();
    const missing = mutable(input); delete missing.panes.panes[0].records[0].values.value;
    assert.throws(() => assertCompleteWindow(missing), (error) => error instanceof PreparedDataError && error.code === 'missing-binding' && error.diagnostic.fieldRef === 'value');
    for (const value of [undefined, '5', Infinity, -Infinity, NaN, {}]) {
        const broken = mutable(input); broken.panes.panes[0].records[0].values.value = value;
        assert.throws(() => assertCompleteWindow(broken), { code: value === undefined ? 'missing-binding' : 'invalid-value' });
    }
});

test('band values must be prepared primitives and facet values must match pane paths', async () => {
    const input = await fixture();
    for (const value of [{ label: 'A' }, ['A'], NaN]) {
        const broken = mutable(input); broken.panes.panes[0].records[0].values.category = value;
        assert.throws(() => assertCompleteWindow(broken), { code: 'invalid-value' });
    }
    const misplaced = mutable(input); misplaced.panes.panes[0].records[0].values.region = 'West';
    assert.throws(() => assertCompleteWindow(misplaced), { code: 'source-contract-violation' });
    const wrongType = mutable(input); wrongType.panes.panes[0].records[0].values.year = 2024;
    assert.throws(() => assertCompleteWindow(wrongType), { code: 'source-contract-violation' });
});

test('time record values reject invalid epochs while null coordinates remain valid', async () => {
    const input = mutable(await fixture());
    input.plan.bindings.find((binding) => binding.fieldRef === 'value')!.valueType = 'time';
    input.plan.bindings.find((binding) => binding.fieldRef === 'value')!.positionType = 'time';
    input.domains.domains.value.type = 'time';
    for (const value of ['2024-01-01', 8_640_000_000_000_001]) {
        const broken = mutable(input); broken.panes.panes[0].records[0].values.value = value;
        assert.throws(() => assertCompleteWindow(broken), { code: 'invalid-value' });
    }
    input.panes.panes[0].records[0].values.value = null;
    input.panes.panes[0].records[0].values.category = null;
    assert.doesNotThrow(() => assertCompleteWindow(input));
});

test('a null facet remains valid when it matches the canonical member path', async () => {
    const initial = await fixture();
    const version = initial.version;
    const records = initial.panes.panes.flatMap((pane) => pane.records.map((record) => ({ ...record.values, region: null })));
    const source = createPreparedDataSource({ version, plan: initial.plan, records });
    const signal = new AbortController().signal;
    const window = { rows: { start: 0, end: 1 }, columns: { start: 0, end: 2 } };
    const input: CompleteWindowInput = { ...initial, window, manifest: await source.describe(signal),
        rows: await source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        columns: await source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        panes: await source.readPaneData({ version, windows: [window] }, signal),
        domains: await source.readDomains({ version, fieldRefs: initial.plan.bindings.map((binding) => binding.fieldRef) }, signal) };
    assert.doesNotThrow(() => assertCompleteWindow(input));
});

test('only the current pane position and active channel columns are required', async () => {
    const initial = await fixture();
    const version = initial.version;
    const plan: RenderPlan = { ...initial.plan,
        bindings: [...initial.plan.bindings, { fieldRef: 'other', bindingId: 'other', columnKey: 'other', label: 'Other', valueType: 'number', positionType: 'linear' }],
        columns: { facets: ['year'], positions: ['value', 'other'] } };
    const records = initial.panes.panes.flatMap((pane) => pane.records.map((record) => ({ ...record.values, other: 99 })));
    const source = createPreparedDataSource({ version, plan, records });
    const signal = new AbortController().signal;
    const window = { rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } };
    const input = mutable({ ...initial, plan, window, manifest: await source.describe(signal),
        rows: await source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        columns: await source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        panes: await source.readPaneData({ version, windows: [window] }, signal),
        domains: await source.readDomains({ version, fieldRefs: plan.bindings.map((binding) => binding.fieldRef) }, signal) });
    for (const record of input.panes.panes[0].records) delete record.values.other;
    assert.doesNotThrow(() => assertCompleteWindow(input));
    input.plan.channels = { color: { fieldRef: 'other' } };
    assert.throws(() => assertCompleteWindow(input), (error) => error instanceof PreparedDataError && error.code === 'missing-binding' && error.diagnostic.fieldRef === 'other');
});

test('declared raw-value columns must be present while preserving raw strings and null', async () => {
    const input = mutable(await fixture());
    input.plan.bindings.find((binding) => binding.fieldRef === 'value')!.rawColumnKey = 'raw_value';
    assert.throws(() => assertCompleteWindow(input), { code: 'missing-binding' });
    for (const pane of input.panes.panes) for (const record of pane.records) record.values.raw_value = 'original text';
    assert.doesNotThrow(() => assertCompleteWindow(input));
    input.panes.panes[0].records[0].values.raw_value = null;
    assert.doesNotThrow(() => assertCompleteWindow(input));
    input.panes.panes[0].records[0].values.raw_value = undefined;
    assert.throws(() => assertCompleteWindow(input), { code: 'missing-binding' });
});
