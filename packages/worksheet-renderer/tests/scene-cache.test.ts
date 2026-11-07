import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource } from '../src/core/prepared';
import { createWindowReader } from '../src/runtime/reader';
import { createResourceManager, estimateBytes } from '../src/runtime/resources';
import { buildScene, type SceneInput } from '../src/scene/build';
import { createSceneCache, sceneAccounting } from '../src/scene/cache';
import { hitTest, hitsInBox, hitIndexBytes } from '../src/scene/hit';
import type { RenderPlan } from '../src/core/types';
const normalized = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'number' ? Math.round(item * 1e8) / 1e8 : item)));
async function fixture(mark: RenderPlan['mark'] = 'point') {
    const plan: RenderPlan = {
        bindings: ['row', 'column', 'x', 'y', 'series'].map((fieldRef) => ({
            fieldRef,
            columnKey: fieldRef,
            bindingId: fieldRef,
            label: fieldRef,
            valueType: ['x', 'y'].includes(fieldRef) ? 'number' : 'string',
            positionType: ['x', 'y'].includes(fieldRef) ? 'linear' : 'band',
        })),
        rows: { facets: ['row'], positions: ['y'] },
        columns: { facets: ['column'], positions: ['x'] },
        mark,
        domainPlanKey: 'cached',
        channels: { color: { fieldRef: 'series' }, ...(mark === 'text' ? { text: { fieldRef: 'y' } } : {}) },
        stack: 'none',
        scales: { x: { zero: true }, y: { zero: true } },
    };
    const records = [];
    for (let row = 0; row < 3; row++)
        for (let column = 0; column < 3; column++)
            for (let i = 0; i < 4; i++)
                records.push({
                    id: `${row}/${column}/${i}`,
                    row: `r${row}`,
                    column: `c${column}`,
                    x: i,
                    y: i - 2,
                    series: i % 2 ? 'b' : 'a',
                });
    const source = createPreparedDataSource({
        plan,
        records,
        version: { sourceId: 'cache', snapshotId: '1', presentationId: '1' },
        getDatumKey: (record) => String(record.id),
    });
    const resources = createResourceManager(),
        reader = createWindowReader(source, plan, resources),
        window = await reader.readWindow({ rows: { start: 0, end: 3 }, columns: { start: 0, end: 3 } });
    const cache = createSceneCache({
        get: (key) => resources.cacheGet('geometry', key),
        put: (key, value, bytes) => resources.cachePut('geometry', key, value, { bytes }),
        remove: (key) => resources.cacheRemove('geometry', key),
        measure: estimateBytes,
    });
    const input: SceneInput = {
        plan,
        rows: window.rows,
        columns: window.columns,
        panes: window.panes,
        domains: window.domains,
        width: 900,
        height: 600,
        scrollX: 0,
        scrollY: 0,
        frameId: 1,
    };
    return {
        plan,
        input,
        cache,
        resources,
        dispose() {
            cache.clear();
            window.release();
            reader.dispose();
            resources.dispose();
        },
    };
}

test('pane-local caches preserve all five marks, clipping, hits and overlays across continuous pixel offsets', async () => {
    for (const mark of ['bar', 'point', 'line', 'rect', 'text'] as const) {
        const f = await fixture(mark);
        for (const offset of [0, 1.25, 2.75, 17.5, 31.125, 55.5]) {
            const input = { ...f.input, scrollX: offset, scrollY: offset / 3 },
                plain = buildScene(input),
                cached = buildScene({ ...input, cache: f.cache });
            assert.deepEqual(normalized(cached.commands), normalized(plain.commands), `${mark} commands ${offset}`);
            assert.deepEqual(normalized(cached.hits), normalized(plain.hits), `${mark} targets ${offset}`);
            const box = { x: 140, y: 100, width: 300, height: 200 };
            assert.deepEqual(
                hitsInBox(cached, box).map((hit) => hit.id),
                hitsInBox(plain, box).map((hit) => hit.id),
            );
            for (const hit of cached.hits) {
                const x = hit.box.x + hit.box.width / 2,
                    y = hit.box.y + hit.box.height / 2;
                assert.equal(hitTest(cached, x, y)?.id, hitTest(plain, x, y)?.id);
            }
            assert(cached.retainedBytes! > hitIndexBytes(cached));
        }
        const first = buildScene({ ...f.input, cache: f.cache }),
            selected = new Set(first.hits.slice(0, 3).map((hit) => hit.id)),
            focusId = first.hits[0]?.id,
            brush = { x: 130, y: 70, width: 80, height: 100 };
        const plain = buildScene({ ...f.input, selected, focusId, brush }),
            selectedFrame = buildScene({ ...f.input, cache: f.cache, selected, focusId, brush });
        assert.deepEqual(normalized(selectedFrame.commands), normalized(plain.commands));
        assert.equal(
            first.paneLayer!.groups[0].commands,
            selectedFrame.paneLayer!.groups[0].commands,
            'selection never recompiles base mark/axis geometry',
        );
        assert(f.cache.stats().hits > f.cache.stats().misses);
        f.dispose();
    }
});

test('plan/layout/domain/data/version/font invalidation rebuilds only valid local geometry', async () => {
    const f = await fixture(),
        original = buildScene({ ...f.input, cache: f.cache });
    const hot = buildScene({ ...f.input, scrollX: 0.125, cache: f.cache });
    assert.equal(original.paneLayer!.groups[0].commands, hot.paneLayer!.groups[0].commands);
    const oldCost = sceneAccounting(original)!,
        hotCost = sceneAccounting(hot)!;
    assert.equal(oldCost.bases[0].value, hotCost.bases[0].value);
    assert.equal(hot.retainedBytes, hotCost.exclusiveBytes + hotCost.bases.reduce((sum, base) => sum + base.bytes, 0));
    const alteredDomains = {
        ...f.input.domains,
        domains: { ...f.input.domains.domains, x: { ...f.input.domains.domains.x, values: [0, 8] } },
    };
    const domainFrame = buildScene({ ...f.input, domains: alteredDomains, cache: f.cache });
    assert.notEqual(hot.paneLayer!.groups[0].commands, domainFrame.paneLayer!.groups[0].commands);
    f.plan.style = { pointSize: 100 };
    const changedPlan = buildScene({ ...f.input, cache: f.cache });
    assert.notEqual(original.paneLayer!.groups[0].commands, changedPlan.paneLayer!.groups[0].commands);
    const changedRecords = {
        ...f.input.panes,
        panes: f.input.panes.panes.map((pane) => ({
            ...pane,
            records: pane.records.map((record) => ({ ...record, values: { ...record.values, y: 1 } })),
        })),
    };
    const recordsFrame = buildScene({ ...f.input, panes: changedRecords, cache: f.cache });
    assert.notEqual(changedPlan.paneLayer!.groups[0].commands, recordsFrame.paneLayer!.groups[0].commands);
    const versionFrame = buildScene({
        ...f.input,
        panes: { ...f.input.panes, version: { ...f.input.panes.version, presentationId: '2' } },
        cache: f.cache,
    });
    assert.notEqual(changedPlan.paneLayer!.groups[0].commands, versionFrame.paneLayer!.groups[0].commands);
    f.cache.clear();
    const fonts = buildScene({ ...f.input, cache: f.cache });
    assert.notEqual(changedPlan.paneLayer!.groups[0].commands, fonts.paneLayer!.groups[0].commands);
    f.plan.layout = { rowHeight: 100, columnWidth: 200 };
    const layout = buildScene({ ...f.input, cache: f.cache });
    assert.notEqual(fonts.paneLayer!.groups[0].commands, layout.paneLayer!.groups[0].commands);
    f.dispose();
});

test('cache entries are bounded, evictable and current frames retain their measured payload after eviction', async () => {
    const f = await fixture(),
        keys = new Map<string, any>();
    let removed = 0;
    const cache = createSceneCache(
        {
            get: (key) => keys.get(key),
            put(key, value) {
                keys.set(key, value);
                return true;
            },
            remove(key) {
                if (keys.delete(key)) removed++;
            },
            measure: estimateBytes,
        },
        2,
    );
    const frame = buildScene({ ...f.input, cache });
    assert.equal(keys.size, 2);
    assert(removed > 0);
    assert(frame.retainedBytes! > estimateBytes({ commands: frame.commands, hits: frame.hits, headers: frame.headers }));
    const retained = frame.retainedBytes;
    cache.clear();
    assert.equal(keys.size, 0);
    assert.equal(frame.retainedBytes, retained);
    assert(frame.hits.length > 0);
    f.dispose();
});

test('candidate pane retention is incremental and a rejected reservation stops further construction', async () => {
    const f = await fixture(),
        retained: { value: object; bytes: number; translated: number }[] = [];
    const frame = buildScene({
        ...f.input,
        cache: f.cache,
        onRetainPane(value, bytes, translated) {
            retained.push({ value, bytes, translated });
        },
    });
    assert.equal(retained.length, frame.paneLayer!.groups.length);
    assert.equal(retained[0].translated, 0);
    assert(retained.slice(1).every((item, index) => item.translated > retained[index].translated));
    assert.deepEqual(
        retained.map((item) => item.value),
        sceneAccounting(frame)!.bases.map((item) => item.value),
    );
    let calls = 0;
    assert.throws(
        () =>
            buildScene({
                ...f.input,
                cache: f.cache,
                onRetainPane() {
                    if (++calls === 2) throw new Error('resource-limit: candidate is full');
                },
            }),
        /candidate is full/,
    );
    assert.equal(calls, 2);
    f.dispose();
});


test('fixed position and channel domains reuse geometry until the fixed plan changes', async () => {
    const f = await fixture();
    const plan: RenderPlan = { ...f.plan, scales: { x: { domain: [0, 10] }, y: { domain: [-10, 10] }, series: { domain: ['a', 'b'] } } };
    const first = buildScene({ ...f.input, plan, cache: f.cache });
    const selected = new Set(first.hits.slice(0, 1).map(hit => hit.id));
    const next = buildScene({ ...f.input, plan, scrollX: 1.25, cache: f.cache, selected });
    assert.equal(first.paneLayer!.groups[0].commands, next.paneLayer!.groups[0].commands);
    assert.deepEqual(normalized(next.commands), normalized(buildScene({ ...f.input, plan, scrollX: 1.25, selected }).commands));
    const changed = buildScene({ ...f.input, plan: { ...plan, scales: { ...plan.scales, y: { domain: [-20, 20] } } }, cache: f.cache });
    assert.notEqual(next.paneLayer!.groups[0].commands, changed.paneLayer!.groups[0].commands);
    f.dispose();
});
