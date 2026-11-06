import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource, advanceBarStack } from '../src/core/prepared';
import { barIsHorizontal, bindingTypedValue, domainKeyFor, domainRequestForWindow, domainStorageKey, getDisplayDomain, hasFixedDomain, positionCoordinate, sharedDomainRefs } from '../src/core/domains';
import { buildScene } from '../src/scene/build';
import { axisLeafKey, pathKey, toTypedValue } from '../src/core/keys';
import { seriesIdentityFor } from '../src/core/series';
import { assertCompleteWindow, type CompleteWindowInput } from '../src/core/validateWindow';
import type { MemberPath, PreparedDataSourceOptions, PreparedRecord, RenderPlan, ResultBinding } from '../src/core/types';

const version = { sourceId: 's1-domains', snapshotId: 'data-1', presentationId: 'view-1' };
const signal = () => new AbortController().signal;
const binding = (ref: string, type: 'band' | 'linear' | 'time' = 'band'): ResultBinding => ({ fieldRef: ref, bindingId: ref, columnKey: ref, label: ref,
    valueType: type === 'band' ? 'string' : type === 'time' ? 'time' : 'number', positionType: type });
const plan = (changes: Partial<RenderPlan> = {}): RenderPlan => ({
    bindings: [binding('region'), binding('category'), binding('year'), binding('label'), binding('value', 'linear'), binding('color'), binding('detail')],
    rows: { facets: ['region', 'category'], positions: ['label'] }, columns: { facets: ['year'], positions: ['value'] },
    mark: 'bar', barOrientation: 'horizontal', stack: 'none', domainPlanKey: 's1-plan', ...changes,
});
const records = [
    { id: 'e1', region: 'East', category: 'A', year: '2024', label: 'one', value: 2, color: 'red', detail: 'north' },
    { id: 'e2', region: 'East', category: 'A', year: '2024', label: 'one', value: 7, color: 'blue', detail: 'south' },
    { id: 'e3', region: 'East', category: 'B', year: '2025', label: 'two', value: 20, color: 'red', detail: 'north' },
    { id: 'w1', region: 'West', category: 'C', year: '2025', label: 'one', value: -5, color: 'blue', detail: 'south' },
];
async function read(plan: RenderPlan, input: readonly PreparedRecord[] = records, extra: Partial<PreparedDataSourceOptions> = {}): Promise<CompleteWindowInput & { source: ReturnType<typeof createPreparedDataSource> }> {
    const source = createPreparedDataSource({ version, plan, records: input, getDatumKey: (record) => String(record.id), ...extra });
    const manifest = await source.describe(signal());
    const window = { rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } };
    const [rows, columns, panes] = await Promise.all([source.readAxis({ version: source.version, axis: 'row', range: window.rows }, signal()),
        source.readAxis({ version: source.version, axis: 'column', range: window.columns }, signal()), source.readPaneData({ version: source.version, windows: [window] }, signal())]);
    const domains = await source.readDomains(domainRequestForWindow(plan, source.version, rows.leaves, columns.leaves), signal());
    return { source, plan, version: source.version, manifest, window, rows, columns, panes, domains };
}

test('pane domains include complete local values and explicit empty-domain coverage for absent pane combinations', async () => {
    const input = await read(plan({ scales: { value: { scope: { mode: 'pane' } }, label: { scope: { mode: 'pane' } } } }));
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const { rows, columns, domains } = input;
    assert.deepEqual(getDisplayDomain(input.plan, 'value', 'x', domains, rows.leaves[0], columns.leaves[0])?.values, [2, 7]);
    const empty = getDisplayDomain(input.plan, 'value', 'x', domains, rows.leaves[0], columns.leaves[1])!;
    assert.equal(empty.empty, true); assert.equal(empty.complete, true); assert.deepEqual(empty.values, [0, 1]);
    assert.deepEqual(getDisplayDomain(input.plan, 'label', 'y', domains, rows.leaves[0], columns.leaves[1])?.values, []);
    assert.equal(Object.keys(domains.domains).length, 12);
    const firstOnly = await input.source.readDomains(domainRequestForWindow(input.plan, version, [rows.leaves[0]], [columns.leaves[0]]), signal());
    assert.deepEqual(getDisplayDomain(input.plan, 'value', 'x', firstOnly, rows.leaves[0], columns.leaves[0]), getDisplayDomain(input.plan, 'value', 'x', domains, rows.leaves[0], columns.leaves[0]));
});

test('prefix domains span complete member prefixes without sharing unrelated branches or units', async () => {
    const input = await read(plan({ scales: { value: { scope: { mode: 'prefix', rowDepth: 1, columnDepth: 0 } } } }));
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const domain = (row: number, column: number) => getDisplayDomain(input.plan, 'value', 'x', input.domains, input.rows.leaves[row], input.columns.leaves[column])!;
    assert.deepEqual(domain(0, 0).values, [2, 20]);
    assert.equal(domain(0, 0).domainId, domain(1, 1).domainId);
    assert.deepEqual(domain(2, 0).values, [-5, -5]);
    assert.notEqual(domain(0, 0).domainId, domain(2, 0).domainId);
    const incompatible = { ...input.plan, bindings: input.plan.bindings.map((binding) => binding.fieldRef === 'value' ? { ...binding, unitKey: 'EUR' } : binding) };
    assert.notEqual(domainKeyFor(input.plan, 'value', 'x', input.rows.leaves[0], input.columns.leaves[0]).familyId,
        domainKeyFor(incompatible, 'value', 'x', input.rows.leaves[0], input.columns.leaves[0]).familyId);
});

test('scoped stacked domains use each full pane stack, then combine endpoints over the requested prefix', async () => {
    const input = await read(plan({ stack: 'zero', scales: { value: { scope: { mode: 'prefix', rowDepth: 1, columnDepth: 0 } } } }), [...records,
        { ...records[0], id: 'negative', value: -4 }, { ...records[0], id: 'negative-2', value: -6 }]);
    const east = getDisplayDomain(input.plan, 'value', 'x', input.domains, input.rows.leaves[0], input.columns.leaves[0])!;
    assert.equal(east.extentKind, 'stacked'); assert.deepEqual(east.values, [-10, 20]);
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const local = await read(plan({ stack: 'zero', scales: { value: { scope: { mode: 'pane' } } } }));
    assert.deepEqual(getDisplayDomain(local.plan, 'value', 'x', local.domains, local.rows.leaves[0], local.columns.leaves[0])?.values, [0, 9]);
});

test('fixed scoped domains retain explicit endpoints including empty logical panes', async () => {
    const input = await read(plan({ scales: { value: { scope: { mode: 'pane' }, domain: [-100, 100] } } }));
    const empty = getDisplayDomain(input.plan, 'value', 'x', input.domains, input.rows.leaves[0], input.columns.leaves[1])!;
    assert.equal(empty.source, 'fixed'); assert.equal(empty.complete, true); assert.deepEqual(empty.values, [-100, 100]);
    assert.equal(input.panes.panes.some((pane) => pane.rowRank === 0 && pane.columnRank === 1), false);
    assert.doesNotThrow(() => assertCompleteWindow(input));
});

test('window domain requests retain shared visual channels alongside scoped positions', async () => {
    const input = await read(plan({ channels: { color: { fieldRef: 'color' }, size: { fieldRef: 'value' } }, scales: { label: { scope: { mode: 'pane' } } } }));
    assert.deepEqual(new Set(sharedDomainRefs(input.plan)), new Set(['value', 'color']));
    const request = domainRequestForWindow(input.plan, version, [input.rows.leaves[0]], [input.columns.leaves[0]]);
    assert.deepEqual(new Set(request.fieldRefs), new Set(['value', 'color'])); assert.equal(request.keys?.length, 1);
});

test('unknown, wrong-family and wrong-plan scoped requests fail instead of returning plausible empty domains', async () => {
    const input = await read(plan({ scales: { value: { scope: { mode: 'pane' } } } }));
    const key = domainKeyFor(input.plan, 'value', 'x', input.rows.leaves[0], input.columns.leaves[0]);
    for (const bad of [{ ...key, familyId: 'wrong' }, { ...key, domainPlanKey: 'wrong' }, { ...key, scope: { mode: 'pane' as const, paneKey: 'unknown' } }]) {
        await assert.rejects(input.source.readDomains({ version, fieldRefs: [], keys: [bad] }, signal()), { code: 'domain-unavailable' });
    }
});

test('scoped domain validation includes confirmed empty slots and rejects absent or substituted scope metadata', async () => {
    const input = await read(plan({ scales: { value: { scope: { mode: 'pane' } } } }));
    const key = domainKeyFor(input.plan, 'value', 'x', input.rows.leaves[0], input.columns.leaves[1]);
    const omitted = { ...input.domains.domains }; delete omitted[domainStorageKey(key)];
    assert.throws(() => assertCompleteWindow({ ...input, domains: { ...input.domains, domains: omitted } }), { code: 'domain-unavailable' });
    const substituted = { ...input.domains.domains, [domainStorageKey(key)]: { ...input.domains.domains[domainStorageKey(key)], key: { ...key, familyId: 'wrong' } } };
    assert.throws(() => assertCompleteWindow({ ...input, domains: { ...input.domains, domains: substituted } }), { code: 'source-contract-violation' });
});

test('collapsed parent leaves show only exact host-prepared parent records and never descendant values', async () => {
    const east: MemberPath = [{ fieldRef: 'region', value: toTypedValue('East') }];
    const west: MemberPath = [{ fieldRef: 'region', value: toTypedValue('West') }, { fieldRef: 'category', value: toTypedValue('C') }];
    const renderPlan = plan({ scales: { value: { scope: { mode: 'pane' } } } });
    const input = await read(renderPlan, [...records, { id: 'parent', region: 'East', year: '2024', label: 'given', value: 101, color: 'red', detail: 'north' }], {
        axisMembers: { row: [{ path: east, collapsed: true }, { path: west }] },
        getRecordPath: (record, _index, axis) => axis === 'column' ? [{ fieldRef: 'year', value: toTypedValue(record.year) }] : record.id === 'parent' ? east : [
            { fieldRef: 'region', value: toTypedValue(record.region) }, { fieldRef: 'category', value: toTypedValue(record.category) }],
    });
    assert.equal(input.rows.leaves[0].path.length, 1); assert.equal(input.rows.leaves[0].collapsed, true);
    const parent = input.panes.panes.find((pane) => pane.rowRank === 0)!;
    assert.deepEqual(parent.records.map((record) => record.datumKey), ['parent']); assert.equal(parent.records[0].values.value, 101);
    assert.deepEqual(getDisplayDomain(renderPlan, 'value', 'x', input.domains, input.rows.leaves[0], input.columns.leaves[0])?.values, [101, 101]);
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const childPath = [...east, { fieldRef: 'category', value: toTypedValue('A') }];
    const location = await input.source.locate({ version, axis: 'row', key: axisLeafKey('row', childPath, input.rows.leaves[0].slotId) }, signal());
    assert.equal(location.status, 'hidden'); if (location.status === 'hidden') assert.equal(pathKey(location.ancestor.path), pathKey(east));
});

test('a missing collapsed parent value stays empty with complete empty domains', async () => {
    const east: MemberPath = [{ fieldRef: 'region', value: toTypedValue('East') }];
    const input = await read(plan({ scales: { value: { scope: { mode: 'pane' } } } }), records, { axisMembers: { row: [{ path: east, collapsed: true }] } });
    assert.equal(input.panes.panes.length, 0); assert.equal(input.manifest.nonEmptyPaneCount, 0);
    assert.deepEqual(input.panes.coveredWindows, [input.window]);
    assert.equal(getDisplayDomain(input.plan, 'value', 'x', input.domains, input.rows.leaves[0], input.columns.leaves[0])?.empty, true);
    assert.doesNotThrow(() => assertCompleteWindow(input));
});

test('both axes accept variable-depth leaves and measure-slot headers retain the correct path depth', async () => {
    const parentPath: MemberPath = [{ fieldRef: 'region', value: toTypedValue('East') }];
    const renderPlan = plan({ bindings: [...plan().bindings, binding('second', 'linear')], rows: { facets: ['region', 'category'], positions: ['value', 'second'] }, columns: { facets: ['year', 'detail'], positions: ['label'] }, barOrientation: 'vertical' });
    const input = await read(renderPlan, [{ id: 'parent', region: 'East', year: '2024', label: 'given', value: 10, second: 30 }], {
        axisMembers: { row: [{ path: parentPath, collapsed: true }], column: [{ path: [{ fieldRef: 'year', value: toTypedValue('2024') }], collapsed: true }] },
        getRecordPath: (record, _index, axis) => axis === 'row' ? parentPath : [{ fieldRef: 'year', value: toTypedValue(record.year) }],
    });
    assert.equal(input.rows.leaves.length, 2); assert.equal(input.columns.leaves[0].path.length, 1);
    assert.ok(input.rows.ancestors.filter((header) => header.kind === 'slot').every((header) => header.depth === 1));
    assert.doesNotThrow(() => assertCompleteWindow(input));
});

test('complete series ordinals use actual joint tuples and remain unchanged between pane windows', async () => {
    const renderPlan = plan({ barLayout: 'grouped', channels: { color: { fieldRef: 'color' }, details: ['detail'] } });
    const input = await read(renderPlan);
    assert.equal(input.domains.series?.keys.length, 2);
    assert.equal(new Set(input.panes.panes.flatMap((pane) => pane.records.map((record) => record.seriesOrdinal))).size, 2);
    assert.ok(input.panes.panes.every((pane) => pane.seriesCount === 2));
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const reordered = await read(renderPlan, [...records].reverse(), { getOrdinal: (record) => records.findIndex((item) => item.id === record.id) });
    assert.deepEqual(reordered.domains.series?.keys, input.domains.series?.keys);
    const explicit = await read(renderPlan, records, { seriesOrder: [...input.domains.series!.keys].reverse() });
    assert.equal(explicit.panes.panes[0].records[0].seriesOrdinal, 1);
    assert.equal(seriesIdentityFor(renderPlan, records[0]), input.domains.series!.keys[0]);
});

test('line data preserves explicit sequence order and null breaks without merging records', async () => {
    const renderPlan = plan({ mark: 'line', channels: { details: ['detail'] } });
    const input = await read(renderPlan, [...records, { ...records[0], id: 'null', value: null }], { getSequenceOrder: (_record, index) => 100 - index });
    assert.equal(input.panes.panes[0].records.length, 3);
    assert.deepEqual(input.panes.panes[0].records.map((record) => record.sequenceOrder), [100, 99, 96]);
    assert.equal(input.panes.panes[0].records[2].values.value, null);
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const partial = { ...input, panes: { ...input.panes, panes: input.panes.panes.map((pane, index) => index ? pane : { ...pane, records: pane.records.map((record, index) => index ? record : { ...record, sequenceOrder: undefined }) }) } };
    assert.throws(() => assertCompleteWindow(partial), { code: 'source-contract-violation' });
});

test('prepared interval endpoints contribute their bounds and keep same-midpoint intervals distinct for stacks', async () => {
    const interval: ResultBinding = { fieldRef: 'interval', bindingId: 'interval', columnKey: 'interval', label: 'Range', valueType: 'interval', positionType: 'time' };
    const renderPlan = plan({ bindings: [interval, binding('value', 'linear')], rows: { facets: [], positions: ['value'] }, columns: { facets: [], positions: ['interval'] }, barOrientation: 'vertical', stack: 'zero' });
    const input = await read(renderPlan, [{ id: 'one', interval: [0, 20], value: 3 }, { id: 'two', interval: [5, 15], value: 7 }, { id: 'three', interval: [0, 20], value: 2 }]);
    assert.deepEqual(input.domains.domains.interval.values, [0, 20]); assert.deepEqual(input.domains.domains.value.values, [0, 7]);
    assert.equal(positionCoordinate(interval, [0, 20]), 10);
    assert.equal(bindingTypedValue(interval, [0, 20]).type, 'interval');
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const stack = new Map(); assert.deepEqual(advanceBarStack(stack, [0, 20], 3), { start: 0, end: 3 });
    assert.deepEqual(advanceBarStack(stack, [5, 15], 7), { start: 0, end: 7 });
    assert.throws(() => bindingTypedValue(interval, [20, 0]), TypeError);
    assert.throws(() => bindingTypedValue(interval, [0, Infinity]), TypeError);
});

test('rect and text consume prepared records without implicit count or aggregation', async () => {
    for (const mark of ['rect', 'text'] as const) {
        const input = await read(plan({ bindings: [binding('label'), binding('color'), binding('text')], rows: { facets: [], positions: ['label'] }, columns: { facets: [], positions: ['color'] }, mark, channels: mark === 'text' ? { text: { fieldRef: 'text' } } : {} }),
            [{ id: 'one', label: 'A', color: 'red', text: 'first' }, { id: 'two', label: 'A', color: 'red', text: null }]);
        assert.equal(input.panes.panes[0].records.length, 2); assert.equal(input.panes.panes[0].records[1].values.text, null);
        assert.doesNotThrow(() => assertCompleteWindow(input));
    }
});

test('stack domain preparation uses the same complete series order as geometry even for rounding-sensitive values', async () => {
    const input = await read(plan({ stack: 'zero', channels: { color: { fieldRef: 'color' } } }), [
        { ...records[0], id: 'a1', color: 'A', value: 1 }, { ...records[0], id: 'b', color: 'B', value: 1e16 }, { ...records[0], id: 'a2', color: 'A', value: 1 },
    ]);
    assert.deepEqual(input.domains.domains.value.values, [0, 1e16 + 2]);
});

test('source presentation parameters remain fixed after the caller mutates its original plan', async () => {
    const renderPlan = plan({ scales: { value: { scope: { mode: 'pane' } } } });
    const input = await read(renderPlan);
    const request = domainRequestForWindow(renderPlan, version, input.rows.leaves, input.columns.leaves);
    const before = await input.source.readDomains(request, signal());
    (renderPlan as { scales: RenderPlan['scales'] }).scales = { value: { scope: { mode: 'shared' }, domain: [0, 999] } };
    assert.deepEqual(await input.source.readDomains(request, signal()), before);
});

test('complete fixed domains draw without source statistics or source band-domain identities', async () => {
    const renderPlan = plan({ scales: { value: { scope: { mode: 'pane' }, domain: [-10, 30] }, label: { domain: ['one', 'two'] } } });
    const original = await read(renderPlan);
    assert.deepEqual(sharedDomainRefs(renderPlan), []);
    assert.deepEqual(domainRequestForWindow(renderPlan, version, original.rows.leaves, original.columns.leaves).keys, []);
    const input = { ...original, rows: { ...original.rows, leaves: original.rows.leaves.map((leaf) => ({ ...leaf, bandDomainId: undefined })) }, domains: { ...original.domains, domains: {} } };
    assert.doesNotThrow(() => assertCompleteWindow(input));
    const scene = buildScene({ ...input, width: 900, height: 700, scrollX: 0, scrollY: 0, frameId: 1 });
    assert.ok(scene.hits.length > 0);
    const unavailable = { ...input, domains: { ...input.domains, domains: {
        value: { fieldRef: 'value', domainId: '', type: 'linear' as const, values: [], complete: false, extentKind: 'value' as const, empty: false, source: 'unavailable' as const },
        label: { fieldRef: 'label', domainId: '', type: 'band' as const, values: [], complete: false, extentKind: 'value' as const, empty: false, source: 'unavailable' as const },
    } } };
    assert.doesNotThrow(() => assertCompleteWindow(unavailable));
    assert.deepEqual(buildScene({ ...unavailable, width: 900, height: 700, scrollX: 0, scrollY: 0, frameId: 1 }).hits, scene.hits);
});

test('two fixed numeric endpoints need no statistics while one endpoint still requires a complete extent', async () => {
    const fixed = await read(plan({ scales: { value: { domainMin: -10, domainMax: 30 } } }));
    assert.equal(hasFixedDomain(fixed.plan, 'value'), true); assert.equal('value' in fixed.domains.domains, false);
    assert.doesNotThrow(() => assertCompleteWindow(fixed));
    const partial = await read(plan({ scales: { value: { domainMin: -10 } } }));
    assert.equal(hasFixedDomain(partial.plan, 'value'), false);
    assert.ok(sharedDomainRefs(partial.plan).includes('value'));
    const missing = { ...partial.domains.domains }; delete missing.value;
    assert.throws(() => assertCompleteWindow({ ...partial, domains: { ...partial.domains, domains: missing } }), { code: 'domain-unavailable' });
});

test('fixed visual channel domains work without statistics and do not waive the line/grouped series contract', async () => {
    const input = await read(plan({ mark: 'point', channels: { color: { fieldRef: 'color' }, size: { fieldRef: 'value' }, opacity: { fieldRef: 'value' }, shape: { fieldRef: 'detail' } },
        scales: { value: { domain: [-10, 30] }, label: { domain: ['one', 'two'] }, color: { domain: ['red', 'blue'] }, detail: { domain: ['north', 'south'] } } }));
    assert.deepEqual(input.domains.domains, Object.create(null));
    assert.doesNotThrow(() => assertCompleteWindow(input));
    assert.ok(buildScene({ ...input, width: 900, height: 700, scrollX: 0, scrollY: 0, frameId: 1 }).hits.length > 0);
    for (const change of [{ mark: 'line' as const }, { mark: 'bar' as const, barLayout: 'grouped' as const }]) {
        assert.throws(() => assertCompleteWindow({ ...input, plan: { ...input.plan, ...change }, domains: { ...input.domains, series: undefined } }), { code: 'domain-unavailable' });
    }
});

test('bar direction uses inferred binding types and preserves explicit orientation', async () => {
    const bindings = plan().bindings.map((binding) => ({ ...binding, positionType: undefined }));
    for (const stack of ['none', 'zero'] as const) {
        const input = await read(plan({ bindings, stack, barOrientation: undefined }));
        assert.doesNotThrow(() => assertCompleteWindow(input));
        assert.ok(buildScene({ ...input, width: 900, height: 700, scrollX: 0, scrollY: 0, frameId: 1 }).hits.length > 0);
        if (stack === 'zero') assert.deepEqual(input.domains.domains.value.values, [-5, 20]);
    }
    assert.equal(barIsHorizontal(plan({ barOrientation: 'vertical' }), binding('label')), false);
});

test('one field can use a pane position domain and a shared color domain', async () => {
    const renderPlan = plan({ mark: 'point', rows: { facets: ['region', 'category'], positions: ['value'] }, columns: { facets: ['year'], positions: ['label'] },
        channels: { color: { fieldRef: 'label' } }, scales: { label: { scope: { mode: 'pane' } } } });
    const input = await read(renderPlan);
    assert.equal(domainKeyFor(renderPlan, 'label', 'color').scope.mode, 'shared');
    assert.deepEqual(getDisplayDomain(renderPlan, 'label', 'color', input.domains)?.values, ['one', 'two']);
    assert.deepEqual(getDisplayDomain(renderPlan, 'label', 'x', input.domains, input.rows.leaves[0], input.columns.leaves[0])?.values, ['one']);
    assert.doesNotThrow(() => assertCompleteWindow(input));
    assert.ok(buildScene({ ...input, width: 900, height: 700, scrollX: 0, scrollY: 0, frameId: 1 }).hits.length > 0);
});

test('external axis responses cannot reorder or omit measure slots within member paths', async () => {
    const renderPlan = plan({ bindings: [...plan().bindings, binding('second', 'linear')], columns: { facets: ['year'], positions: ['value', 'second'] } });
    const input = await read(renderPlan, records.map((record) => ({ ...record, second: record.value * 2 })));
    const leaves = input.columns.leaves.map((leaf) => ({ ...leaf, rank: leaf.rank % 2 === 0 ? leaf.rank + 1 : leaf.rank - 1 })).sort((a, b) => a.rank - b.rank);
    const ranks = new Map(leaves.map((leaf) => [leaf.key, leaf.rank]));
    const broken = { ...input, columns: { ...input.columns, leaves, ancestors: input.columns.ancestors.map((header) => {
        if (header.kind !== 'slot') return header;
        const start = ranks.get(JSON.parse(header.key)[1])!;
        return { ...header, start, end: start + 1 };
    }) }, panes: { ...input.panes, panes: input.panes.panes.map((pane) => ({ ...pane, columnRank: ranks.get(pane.columnKey)! })) } };
    assert.throws(() => assertCompleteWindow(broken), { code: 'source-contract-violation' });
    const missing = { ...input, manifest: { ...input.manifest, columnLeafCount: input.manifest.columnLeafCount - 1 } };
    assert.throws(() => assertCompleteWindow(missing), { code: 'source-contract-violation' });
    const window = { rows: input.window.rows, columns: { start: 1, end: 2 } };
    const columns = await input.source.readAxis({ version, axis: 'column', range: window.columns }, signal());
    const panes = await input.source.readPaneData({ version, windows: [window] }, signal());
    const domains = await input.source.readDomains(domainRequestForWindow(renderPlan, version, input.rows.leaves, columns.leaves), signal());
    assert.doesNotThrow(() => assertCompleteWindow({ ...input, window, columns, panes, domains }));
});
