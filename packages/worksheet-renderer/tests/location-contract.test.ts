import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource } from '../src/core/prepared';
import { axisLeafKey, headerKey, toTypedValue } from '../src/core/keys';
import { assertLocation } from '../src/core/validateWindow';
import type { AxisLocation, LocateRequest, MemberPath, RenderPlan } from '../src/core/types';

const version = { sourceId: 'locate', snapshotId: 'data', presentationId: 'view' };
const plan: RenderPlan = {
    bindings: ['region', 'category', 'value', 'other'].map((fieldRef) => ({ fieldRef, bindingId: fieldRef, columnKey: fieldRef, label: fieldRef,
        valueType: fieldRef === 'value' || fieldRef === 'other' ? 'number' : 'string', positionType: fieldRef === 'value' || fieldRef === 'other' ? 'linear' : 'band' })),
    rows: { facets: ['region', 'category'], positions: ['value', 'other'] }, columns: { facets: [], positions: [] }, mark: 'point', domainPlanKey: 'locate-plan',
};
const records = [{ id: 'east', region: 'East', category: 'Chair', value: 1, other: 2 }, { id: 'west', region: 'West', category: 'Paper', value: 3, other: 4 }];
async function fixture() {
    const signal = new AbortController().signal;
    const source = createPreparedDataSource({ version, plan, records });
    const manifest = await source.describe(signal);
    const rows = await source.readAxis({ version, axis: 'row', range: { start: 0, end: manifest.rowLeafCount } }, signal);
    const request: LocateRequest = { version, axis: 'row', key: rows.leaves[0].key, path: rows.leaves[0].path };
    const location = await source.locate(request, signal);
    return { source, manifest, rows, request, location, signal };
}

test('valid found and missing locations preserve request identity and read version', async () => {
    const input = await fixture();
    assert.doesNotThrow(() => assertLocation({ ...input, plan }));
    assert.doesNotThrow(() => assertLocation({ ...input, plan, request: { ...input.request, key: 'unknown', path: undefined }, location: { version, status: 'missing' } }));
    assert.throws(() => assertLocation({ ...input, plan, location: { version: { ...version, presentationId: 'old' }, status: 'missing' } }), { code: 'version-expired' });
});

test('a same-version source cannot locate a different existing key or a different measure slot', async () => {
    const input = await fixture();
    const wrong: AxisLocation = { version, status: 'found', rank: input.rows.leaves[2].rank, leaf: input.rows.leaves[2] };
    assert.throws(() => assertLocation({ ...input, plan, location: wrong }), { code: 'source-contract-violation' });
    const slot: AxisLocation = { version, status: 'found', rank: 1, leaf: { ...input.rows.leaves[0], rank: 1 } };
    assert.throws(() => assertLocation({ ...input, plan, location: slot }), { code: 'source-contract-violation' });
});

test('located ranks and canonical paths must agree with the manifest and request', async () => {
    const input = await fixture();
    for (const rank of [-1, 0.5, 4, Number.MAX_SAFE_INTEGER, NaN]) {
        assert.throws(() => assertLocation({ ...input, plan, location: { version, status: 'found', rank, leaf: { ...input.rows.leaves[0], rank } } }), { code: 'source-contract-violation' });
    }
    assert.throws(() => assertLocation({ ...input, plan, location: { version, status: 'found', rank: 0, leaf: { ...input.rows.leaves[0], rank: 2 } } }), { code: 'source-contract-violation' });
    assert.throws(() => assertLocation({ ...input, plan, request: { ...input.request, path: input.rows.leaves[2].path } }), { code: 'source-contract-violation' });
    assert.throws(() => assertLocation({ ...input, plan, location: { version, status: 'found', rank: 0, leaf: { ...input.rows.leaves[0], path: input.rows.leaves[2].path } } }), { code: 'source-contract-violation' });
});

test('hidden locations require a safe visible ancestor span of the exact requested path', async () => {
    const original = await fixture();
    const east: MemberPath = [{ fieldRef: 'region', value: toTypedValue('East') }];
    const source = createPreparedDataSource({ version, plan, records, axisMembers: { row: [{ path: east, collapsed: true }] } });
    const manifest = await source.describe(original.signal);
    const request: LocateRequest = { version, axis: 'row', key: original.request.key };
    const location = await source.locate(request, original.signal);
    assert.equal(location.status, 'hidden');
    assert.doesNotThrow(() => assertLocation({ plan, request, manifest, location }));
    if (location.status !== 'hidden') return;
    const wrongPath: MemberPath = [{ fieldRef: 'region', value: toTypedValue('West') }];
    for (const ancestor of [
        { ...location.ancestor, path: wrongPath, key: headerKey('row', wrongPath) },
        { ...location.ancestor, path: original.rows.leaves[0].path, depth: 1, key: headerKey('row', original.rows.leaves[0].path) },
        { ...location.ancestor, start: -1 }, { ...location.ancestor, end: 3 }, { ...location.ancestor, end: 1 },
        { ...location.ancestor, depth: 1 }, { ...location.ancestor, key: 'wrong-header' },
    ]) assert.throws(() => assertLocation({ plan, request, manifest, location: { version, status: 'hidden', ancestor } }), { code: 'source-contract-violation' });
    const columnKey = axisLeafKey('column', original.rows.leaves[0].path, original.rows.leaves[0].slotId);
    assert.throws(() => assertLocation({ plan, manifest, location, request: { ...request, key: columnKey } }), { code: 'source-contract-violation' });
});
