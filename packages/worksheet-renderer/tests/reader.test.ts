import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedDataSource } from '../src/core/prepared';
import type { PaneBatch, PaneWindow, RenderDataSource, RenderPlan } from '../src/core/types';
import { createResourceManager, estimateBytes } from '../src/runtime/resources';
import { createWindowReader, type WindowProgress } from '../src/runtime/reader';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const window = (start = 0, end = 4): PaneWindow => ({ rows: { start, end }, columns: { start: 0, end: 2 } });
function fixture(overrides: Partial<RenderDataSource> = {}) {
    const plan: RenderPlan = {
        bindings: ['r', 'c', 'category', 'value'].map((fieldRef) => ({
            fieldRef,
            columnKey: fieldRef,
            bindingId: fieldRef,
            label: fieldRef,
            valueType: fieldRef === 'value' ? 'number' : 'string',
            positionType: fieldRef === 'value' ? 'linear' : 'band',
        })),
        rows: { facets: ['r'], positions: ['category'] },
        columns: { facets: ['c'], positions: ['value'] },
        mark: 'bar',
        stack: 'none',
        domainPlanKey: 'reader-bars',
    };
    const records = [];
    for (let r = 0; r < 6; r++)
        for (let c = 0; c < 3; c++)
            for (let datum = 0; datum < 2; datum++)
                records.push({ id: `${r}/${c}/${datum}`, r: `r${r}`, c: `c${c}`, category: `item${datum}`, value: r * 10 + c + datum });
    const base = createPreparedDataSource({
        version: { sourceId: 'reader', snapshotId: '1', presentationId: '1' },
        plan,
        records,
        getDatumKey: (record) => String(record.id),
    });
    const calls = {
        describe: 0,
        axes: [] as unknown[],
        domains: 0,
        panes: [] as { windows: readonly PaneWindow[]; cursor?: string }[],
        locate: 0,
    };
    const source: RenderDataSource = {
        ...base,
        async describe(signal) {
            calls.describe++;
            return base.describe(signal);
        },
        async readAxis(request, signal) {
            calls.axes.push(request);
            return base.readAxis(request, signal);
        },
        async readDomains(request, signal) {
            calls.domains++;
            return base.readDomains(request, signal);
        },
        async readPaneData(request, signal) {
            calls.panes.push(request);
            return base.readPaneData(request, signal);
        },
        async locate(request, signal) {
            calls.locate++;
            return base.locate(request, signal);
        },
        ...overrides,
    };
    const resources = createResourceManager(),
        reader = createWindowReader(source, plan, resources);
    return { base, source, plan, resources, reader, calls };
}

test('hot and contained windows do not re-read, and an overlapping move reads only the uncovered strip', async () => {
    const f = fixture(),
        first = await f.reader.readWindow(window());
    first.release();
    const counts = { axes: f.calls.axes.length, panes: f.calls.panes.length, domains: f.calls.domains };
    (await f.reader.readWindow(window(1, 3))).release();
    assert.deepEqual({ axes: f.calls.axes.length, panes: f.calls.panes.length, domains: f.calls.domains }, counts);
    const moved = await f.reader.readWindow(window(2, 6));
    assert.equal(moved.panes.panes.length, 8);
    moved.release();
    assert.deepEqual(f.calls.panes[1].windows, [window(4, 6)]);
    assert.equal(f.calls.axes.length, 3);
    f.reader.dispose();
    f.resources.dispose();
});

test('simultaneous adjacent windows merge axis ranges and one pane batch, without per-pane reads', async () => {
    const f = fixture();
    const results = await Promise.all([f.reader.readWindow(window(0, 2)), f.reader.readWindow(window(2, 4))]);
    assert.equal(f.calls.panes.length, 1);
    assert.deepEqual(f.calls.panes[0].windows, [window()]);
    assert.equal(f.calls.axes.length, 2);
    assert.deepEqual(
        results.map((result) => result.panes.panes.length),
        [4, 4],
    );
    results.forEach((result) => result.release());
    f.reader.dispose();
    f.resources.dispose();
});

test('pagination retains partial pane records internally, exposes no half pane and keeps the original cursor window', async () => {
    const f = fixture(),
        requests: unknown[] = [];
    f.source.readPaneData = async (request, signal) => {
        requests.push(request);
        const full = await f.base.readPaneData({ ...request, cursor: undefined }, signal),
            first = full.panes[0];
        if (!request.cursor)
            return {
                version: full.version,
                panes: [{ ...first, complete: false, records: first.records.slice(0, 1) }],
                coveredWindows: [],
                nextCursor: 'page-2',
            };
        return { ...full, panes: [{ ...first, records: first.records.slice(1) }, ...full.panes.slice(1)] };
    };
    const progress: WindowProgress[] = [],
        result = await f.reader.readWindow(window(), { onProgress: (item) => progress.push(item) });
    assert.equal(progress.length, 1);
    assert.equal(progress[0].panes.panes.length, 0);
    assert.equal(progress[0].status, 'loading');
    assert.deepEqual(progress[0].loadingWindows, [window()]);
    assert.equal(result.panes.panes[0].records.length, 2);
    assert.equal(result.status, 'complete');
    assert.deepEqual(
        requests.map((request: any) => request.windows),
        [[window()], [window()]],
    );
    assert.equal((requests[1] as any).cursor, 'page-2');
    assert(result.timings.readMs >= 0);
    result.release();
    f.reader.dispose();
    f.resources.dispose();
});

test('only a validated complete pane appears in progress and source-certified empty coverage stays distinct from loading', async () => {
    const f = fixture();
    f.source.readPaneData = async (request, signal) => {
        const full = await f.base.readPaneData({ ...request, cursor: undefined }, signal);
        return request.cursor
            ? full
            : {
                  version: full.version,
                  panes: [full.panes[0]],
                  coveredWindows: [{ rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } }],
                  nextCursor: 'next',
              };
    };
    const progress: WindowProgress[] = [];
    const result = await f.reader.readWindow(window(), { onProgress: (item) => progress.push(item) });
    assert.equal(progress[0].panes.panes.length, 1);
    assert.equal(progress[0].domainsReady, true);
    assert.equal(progress[0].loadingWindows.length, 2);
    result.release();
    f.reader.dispose();
    f.resources.dispose();
});

test('cyclic cursors, conflicting data and a terminal incomplete window fail explicitly', async () => {
    for (const kind of ['cycle', 'conflict', 'missing'] as const) {
        const f = fixture();
        let progress = 0;
        f.source.readPaneData = async (request, signal) => {
            const full = await f.base.readPaneData({ ...request, cursor: undefined }, signal),
                pane = full.panes[0];
            if (kind === 'missing') return { ...full, coveredWindows: [] };
            if (!request.cursor)
                return { version: full.version, panes: [{ ...pane, complete: false }], coveredWindows: [], nextCursor: 'same' };
            if (kind === 'cycle') return { version: full.version, panes: [], coveredWindows: [], nextCursor: 'same' };
            return {
                ...full,
                panes: [
                    {
                        ...pane,
                        records: [{ ...pane.records[0], values: { ...pane.records[0].values, value: 999 } }, ...pane.records.slice(1)],
                    },
                    ...full.panes.slice(1),
                ],
            };
        };
        await assert.rejects(
            f.reader.readWindow(window(), {
                onProgress: () => {
                    progress++;
                },
            }),
            (error) => ['source-contract-violation', 'incomplete-data'].includes((error as any).code),
        );
        if (kind === 'missing') assert.equal(progress, 0);
        assert.equal(f.resources.stats().reservedBytes, 0);
        f.reader.dispose();
        f.resources.dispose();
    }
});

test('preview can return explicit placeholders with incomplete domains and no fabricated coverage', async () => {
    const f = fixture();
    f.source.describe = async (signal) => ({ ...(await f.base.describe(signal)), status: 'preview' });
    f.source.readDomains = async (request, signal) => {
        const domains = await f.base.readDomains(request, signal);
        return {
            ...domains,
            domains: Object.fromEntries(Object.entries(domains.domains).map(([ref, value]) => [ref, { ...value, complete: false }])),
        };
    };
    f.source.readPaneData = async (request, signal) => {
        const batch = await f.base.readPaneData({ ...request, cursor: undefined }, signal);
        return { ...batch, coveredWindows: [], panes: batch.panes.map((pane) => ({ ...pane, complete: false })) };
    };
    const result = await f.reader.readWindow(window());
    assert.equal(result.status, 'preview');
    assert.equal(result.domainsReady, false);
    assert.deepEqual(result.panes.panes, []);
    assert.deepEqual(result.panes.coveredWindows, []);
    assert.deepEqual(result.loadingWindows, [window()]);
    result.release();
    f.reader.dispose();
    f.resources.dispose();
});

test('fixed-only windows bypass unavailable statistical-domain reads', async () => {
    const f = fixture();
    const plan = { ...f.plan, scales: { category: { domain: ['item0', 'item1'] }, value: { domain: [0, 100] } } };
    f.source.readDomains = async () => {
        throw new Error('statistics unavailable');
    };
    const reader = createWindowReader(f.source, plan, f.resources);
    const result = await reader.readWindow(window());
    assert.equal(result.domainsReady, true);
    result.release();
    reader.dispose();
    f.reader.dispose();
    f.resources.dispose();
});

test('reader disposal cancels only its consumer of a shared metadata read', async () => {
    const f = fixture();
    let finish!: (manifest: any) => void;
    f.source.describe = async () =>
        new Promise((resolve) => {
            finish = resolve;
        });
    const other = createWindowReader(f.source, f.plan, f.resources);
    const a = f.reader.describe(),
        b = other.describe({ partition: 'export', priority: 'export' });
    await tick();
    const rejected = assert.rejects(a, { name: 'AbortError' });
    f.reader.dispose();
    await rejected;
    finish(await f.base.describe(new AbortController().signal));
    assert.equal((await b).version.snapshotId, '1');
    other.dispose();
    f.resources.dispose();
});

test('record/page and required memory limits reject rather than truncate, releasing all temporary reservations', async () => {
    const f = fixture(),
        small = createWindowReader(f.source, f.plan, f.resources, { maxPaneRecords: 1 });
    await assert.rejects(small.readWindow(window()), { code: 'resource-limit' });
    assert.equal(f.resources.stats().reservedBytes, 0);
    small.dispose();
    f.reader.dispose();
    f.resources.dispose();
    const tiny = createResourceManager({ maxBytes: 1000 }),
        reader = createWindowReader(f.source, f.plan, tiny);
    await assert.rejects(reader.readWindow(window()), { code: 'resource-limit' });
    assert.equal(tiny.stats().reservedBytes, 0);
    reader.dispose();
    tiny.dispose();
});

test('export leases and cache partitions release independently from a display reader', async () => {
    const f = fixture(),
        exporting = createWindowReader(f.source, f.plan, f.resources);
    const display = await f.reader.readWindow(window()),
        page = await exporting.readWindow(window(4, 6), { partition: 'export', priority: 'export' });
    assert(f.resources.stats().partitions.export > 0);
    page.release();
    exporting.dispose();
    assert.equal(f.resources.stats().partitions.export, 0);
    assert(f.resources.stats().reservedBytes > 0);
    display.release();
    assert.equal(f.resources.stats().reservedBytes, 0);
    f.reader.dispose();
    f.resources.dispose();
});

test('an in-flight overlapping read is shared and only its uncovered adjacent strip is requested', async () => {
    const f = fixture();
    const completions: (() => void)[] = [];
    f.source.readPaneData = async (request, signal) => {
        f.calls.panes.push(request);
        await new Promise<void>((resolve) => completions.push(resolve));
        return f.base.readPaneData(request, signal);
    };
    const first = f.reader.readWindow(window(0, 4));
    while (!f.calls.panes.length) await tick();
    const second = f.reader.readWindow(window(2, 6));
    while (f.calls.panes.length < 2) await tick();
    assert.deepEqual(
        f.calls.panes.map((item) => item.windows),
        [[window(0, 4)], [window(4, 6)]],
    );
    for (const complete of completions) complete();
    const results = await Promise.all([first, second]);
    assert.deepEqual(
        results.map((item) => item.panes.panes.length),
        [8, 8],
    );
    results.forEach((item) => item.release());
    f.reader.dispose();
    f.resources.dispose();
});

test('one cancelled window consumer does not cancel a contained peer and late cancelled responses never populate cache', async () => {
    const f = fixture();
    let complete!: () => void;
    f.source.readPaneData = async (request, signal) => {
        f.calls.panes.push(request);
        await new Promise<void>((resolve) => {
            complete = resolve;
        });
        return f.base.readPaneData(request, signal);
    };
    const abort = new AbortController(),
        first = f.reader.readWindow(window(), { signal: abort.signal });
    while (!f.calls.panes.length) await tick();
    const second = f.reader.readWindow(window(1, 3));
    await tick();
    const rejected = assert.rejects(first, { name: 'AbortError' });
    abort.abort();
    await rejected;
    complete();
    const result = await second;
    assert.equal(result.panes.panes.length, 4);
    assert.equal(f.calls.panes.length, 1);
    result.release();
    f.reader.dispose();
    f.resources.dispose();
});

test('different source objects with identical logical version IDs do not reuse unverified response caches', async () => {
    const f = fixture();
    (await f.reader.readWindow(window())).release();
    const altered: RenderDataSource = {
        ...f.source,
        async readPaneData(request, signal) {
            const data = await f.base.readPaneData(request, signal);
            return { ...data, coveredWindows: [] };
        },
    };
    const other = createWindowReader(altered, f.plan, f.resources);
    await assert.rejects(other.readWindow(window()), { code: 'incomplete-data' });
    other.dispose();
    f.reader.dispose();
    f.resources.dispose();
});

test('no source rank cache crosses a presentation and abandoned result leases are released on reader disposal', async () => {
    const f = fixture();
    const first = await f.reader.readWindow(window());
    const nextVersion = { ...f.source.version, presentationId: 'reordered' };
    let axisCalls = 0;
    const reordered: RenderDataSource = {
        ...f.source,
        version: nextVersion,
        async describe(signal) {
            return { ...(await f.base.describe(signal)), version: nextVersion };
        },
        async readAxis(request, signal) {
            axisCalls++;
            return { ...(await f.base.readAxis({ ...request, version: f.base.version }, signal)), version: nextVersion };
        },
    };
    const next = createWindowReader(reordered, f.plan, f.resources);
    await next.readAxis('row', window().rows);
    assert.equal(axisCalls, 1);
    assert(f.resources.stats().reservedBytes > 0);
    f.reader.dispose();
    assert.equal(f.resources.stats().reservedBytes, 0);
    first.release();
    next.dispose();
    f.resources.dispose();
});

test('optional overscan cannot expand a required viewport beyond its per-consumer record budget', async () => {
    const f = fixture();
    f.source.readPaneData = async (request, signal) => {
        f.calls.panes.push(request);
        const batch = await f.base.readPaneData(request, signal);
        return {
            ...batch,
            panes: batch.panes.map((pane) => ({
                ...pane,
                records: Array.from({ length: 11_000 }, (_, ordinal) => ({
                    ...pane.records[0],
                    datumKey: `${pane.rowRank}/${ordinal}`,
                    ordinal,
                })),
            })),
        };
    };
    const first = { rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } },
        second = { rows: { start: 1, end: 2 }, columns: { start: 0, end: 1 } };
    const results = await Promise.all([
        f.reader.readWindow(first, { priority: 'viewport' }),
        f.reader.readWindow(second, { priority: 'overscan' }),
    ]);
    assert.equal(f.calls.panes.length, 2);
    assert(results.every((result) => result.panes.panes[0].records.length === 11_000));
    results.forEach((result) => result.release());
    f.reader.dispose();
    f.resources.dispose();
});

test('a required viewport does not join a larger in-flight overscan that will exceed its own limit', async () => {
    const f = fixture();
    let releaseOverscan!: () => void;
    f.source.readPaneData = async (request, signal) => {
        f.calls.panes.push(request);
        if (request.windows[0].rows.end === 2)
            await new Promise<void>((resolve) => {
                releaseOverscan = resolve;
            });
        const batch = await f.base.readPaneData(request, signal);
        return {
            ...batch,
            panes: batch.panes.map((pane) => ({
                ...pane,
                records: Array.from({ length: 11_000 }, (_, ordinal) => ({
                    ...pane.records[0],
                    datumKey: `${pane.rowRank}/${ordinal}`,
                    ordinal,
                })),
            })),
        };
    };
    const large = { rows: { start: 0, end: 2 }, columns: { start: 0, end: 1 } },
        small = { rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } };
    const optional = f.reader.readWindow(large, { priority: 'overscan' });
    const rejected = assert.rejects(optional, { code: 'resource-limit' });
    while (!releaseOverscan) await tick();
    const required = await f.reader.readWindow(small, { priority: 'viewport' });
    assert.equal(required.panes.panes[0].records.length, 11_000);
    assert.equal(f.calls.panes.length, 2);
    releaseOverscan();
    await rejected;
    required.release();
    f.reader.dispose();
    f.resources.dispose();
});

test('actual prepared preview with incomplete series metadata yields explicit unknown placeholders', async () => {
    for (const grouped of [false, true]) {
        const f = fixture();
        const plan: RenderPlan = { ...f.plan, barLayout: grouped ? 'grouped' : 'overlap' };
        const source = createPreparedDataSource({
            version: f.base.version,
            plan,
            complete: false,
            records: [{ id: 'preview', r: 'r0', c: 'c0', category: 'A', value: 8 }],
            getDatumKey: (record) => String(record.id),
        });
        const reader = createWindowReader(source, plan, f.resources);
        const result = await reader.readWindow({ rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } });
        assert.equal(result.status, 'preview');
        assert.equal(result.domainsReady, false);
        assert.deepEqual(result.panes.panes, []);
        assert.deepEqual(result.panes.coveredWindows, []);
        assert.notEqual(result.domains.series?.complete, true);
        result.release();
        reader.dispose();
        f.reader.dispose();
        f.resources.dispose();
    }
});

test('scanning unrelated window descriptors does not promote them ahead of the hottest cached window', async () => {
    const f = fixture(),
        resources = createResourceManager({ maxEntries: 8 }),
        reader = createWindowReader(f.source, f.plan, resources);
    const read = async (row: number) =>
        (await reader.readWindow({ rows: { start: row, end: row + 1 }, columns: { start: 0, end: 1 } })).release();
    await read(0);
    await read(1);
    for (let repeat = 0; repeat < 4; repeat++) await read(0);
    await read(2);
    await read(0);
    assert.deepEqual(
        f.calls.panes.map((request) => request.windows[0].rows.start),
        [0, 1, 2],
    );
    reader.dispose();
    resources.dispose();
    f.reader.dispose();
    f.resources.dispose();
});

test('cancelling one required consumer does not shrink the capacity of its already batched peer read', async () => {
    const f = fixture();
    let release!: () => void;
    f.source.readPaneData = async (request, signal) => {
        f.calls.panes.push(request);
        await new Promise<void>((resolve) => {
            release = resolve;
        });
        const batch = await f.base.readPaneData(request, signal);
        return {
            ...batch,
            panes: batch.panes.map((pane) => ({
                ...pane,
                records: Array.from({ length: 11_000 }, (_, ordinal) => ({
                    ...pane.records[0],
                    datumKey: `${pane.rowRank}/${ordinal}`,
                    ordinal,
                })),
            })),
        };
    };
    const aborted = new AbortController(),
        first = f.reader.readWindow({ rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } }, { signal: aborted.signal });
    const second = f.reader.readWindow({ rows: { start: 1, end: 2 }, columns: { start: 0, end: 1 } });
    while (!release) await tick();
    assert.equal(f.calls.panes.length, 1);
    const rejected = assert.rejects(first, { name: 'AbortError' });
    aborted.abort();
    await rejected;
    release();
    const result = await second;
    assert.equal(result.panes.panes[0].records.length, 11_000);
    result.release();
    f.reader.dispose();
    f.resources.dispose();
});

test('a hot-window lookup never touches unrelated cached pane entries even when there is ample capacity', async () => {
    const f = fixture(),
        touched: number[] = [],
        get = f.resources.cacheGet.bind(f.resources);
    f.resources.cacheGet = ((layer: any, key: string, partition?: any) => {
        const [, kind, windows] = JSON.parse(key);
        if (layer === 'data' && kind === 'panes') touched.push(windows[0].rows.start);
        return get(layer, key, partition);
    }) as typeof f.resources.cacheGet;
    const read = async (row: number) =>
        (await f.reader.readWindow({ rows: { start: row, end: row + 1 }, columns: { start: 0, end: 1 } })).release();
    await read(0);
    await read(1);
    touched.length = 0;
    await read(0);
    assert(!touched.includes(1));
    f.reader.dispose();
    f.resources.dispose();
});

test('reader CPU timing excludes awaited latency, provider synchronous work and host progress callbacks', async () => {
    const f = fixture();
    const spin = (milliseconds: number) => {
        const until = performance.now() + milliseconds;
        while (performance.now() < until) {}
    };
    f.source.readPaneData = (request, signal) => {
        spin(18);
        return new Promise<PaneBatch>((resolve) =>
            setTimeout(async () => {
                const full = await f.base.readPaneData({ ...request, cursor: undefined }, signal);
                resolve(request.cursor ? full : { ...full, panes: [], coveredWindows: [], nextCursor: 'second' });
            }, 25),
        );
    };
    const result = await f.reader.readWindow(window(0, 1), { onProgress: () => spin(22) });
    assert(result.timings.sourceSyncMs >= 30);
    assert(result.timings.readMs >= 95);
    assert(result.timings.readerCpuMs < result.timings.readMs - result.timings.sourceSyncMs - 40);
    const recorded = result.timings.readerCpuMs;
    result.release();
    (await f.reader.readWindow(window(0, 1))).release();
    assert.equal(result.timings.readerCpuMs, recorded);
    f.reader.dispose();
    f.resources.dispose();
});

test('exact complete windows reuse validation while source and consumer mutations cannot change the owned bundle', async () => {
    const f = fixture(),
        supplied: any[] = [];
    const snapshot = <T>(value: T): T => {
        const copy = structuredClone(value);
        supplied.push(copy);
        return copy;
    };
    f.source.describe = async (signal) => {
        f.calls.describe++;
        return snapshot(await f.base.describe(signal));
    };
    f.source.readAxis = async (request, signal) => {
        f.calls.axes.push(request);
        return snapshot(await f.base.readAxis(request, signal));
    };
    f.source.readDomains = async (request, signal) => {
        f.calls.domains++;
        return snapshot(await f.base.readDomains(request, signal));
    };
    f.source.readPaneData = async (request, signal) => {
        f.calls.panes.push(request);
        return snapshot(await f.base.readPaneData(request, signal));
    };
    const first = await f.reader.readWindow(window());
    assert(first.timings.validationCpuMs > 0);
    const originalValue = first.panes.panes[0].records[0].values.value,
        originalLabel = first.rows.leaves[0].path[0].value;
    for (const response of supplied) {
        if (response.panes) response.panes[0].records[0].values.value = 'invalid mutated numeric value';
        if (response.leaves) response.leaves[0].path[0].value = { type: 'string', value: 'different member' };
        if (response.domains) for (const domain of Object.values(response.domains) as any[]) domain.complete = false;
        if ('rowLeafCount' in response) response.rowLeafCount = 999;
    }
    assert.throws(() => {
        (first.panes.panes[0].records[0].values as any).value = 1000;
    }, TypeError);
    first.release();
    const reads = f.resources.stats().reads;
    const hot = await f.reader.readWindow(window());
    assert.equal(hot.timings.validationCpuMs, 0);
    assert.equal(hot.timings.sourceSyncMs, 0);
    assert.equal(f.resources.stats().reads, reads);
    assert.equal(hot.panes.panes[0].records[0].values.value, originalValue);
    assert.deepEqual(hot.rows.leaves[0].path[0].value, originalLabel);
    assert.equal(hot.manifest.rowLeafCount, 6);
    assert(f.resources.stats().reservedBytes > 0);
    assert(f.resources.stats().bytes <= f.resources.stats().maxBytes);
    hot.release();
    f.reader.dispose();
    f.resources.dispose();
});

test('complete-window validation caches include the entire plan and enforce each reader record limit', async () => {
    const f = fixture();
    (await f.reader.readWindow(window())).release();
    const same = createWindowReader(f.source, structuredClone(f.plan), f.resources);
    const shared = await same.readWindow(window());
    assert.equal(shared.timings.validationCpuMs, 0);
    shared.release();
    const strict = createWindowReader(f.source, f.plan, f.resources, { maxPaneRecords: 1 });
    await assert.rejects(strict.readWindow(window()), { code: 'resource-limit' });
    const different: RenderPlan = {
        ...f.plan,
        bindings: f.plan.bindings.map((binding) => (binding.fieldRef === 'value' ? { ...binding, columnKey: 'unprepared' } : binding)),
    };
    const altered = createWindowReader(f.source, different, f.resources);
    await assert.rejects(altered.readWindow(window()), { code: 'missing-binding' });
    (f.plan.bindings[0] as any).columnKey = 'host changed plan';
    const stable = await f.reader.readWindow(window());
    assert.equal(stable.plan.bindings[0].columnKey, 'r');
    stable.release();
    same.dispose();
    strict.dispose();
    altered.dispose();
    f.reader.dispose();
    f.resources.dispose();
});

test('retained payload accounting is stable on exact cache hits and preserves complete pane identity across overlapping windows', async () => {
    const f = fixture(),
        first = await f.reader.readWindow(window());
    const size = (value: WindowProgress) =>
        estimateBytes({
            plan: value.plan,
            version: value.version,
            manifest: value.manifest,
            window: value.window,
            rows: value.rows,
            columns: value.columns,
            panes: value.panes,
            domains: value.domains,
        });
    assert.equal(first.retainedBytes, size(first));
    assert(first.retainedBytes > 0);
    const hot = await f.reader.readWindow(window());
    assert.equal(hot.retainedBytes, first.retainedBytes);
    assert.equal(hot.timings.validationCpuMs, 0);
    const subset = await f.reader.readWindow(window(1, 3));
    assert.equal(subset.retainedBytes, size(subset));
    const samePane = first.panes.panes.find((pane) => pane.key === subset.panes.panes[0].key)!;
    assert.equal(subset.panes.panes[0], samePane);
    assert.equal(subset.panes.panes[0].records, samePane.records);
    assert.equal(subset.domains.domains.value, first.domains.domains.value);
    for (const result of [first, hot, subset]) result.release();
    assert.equal(f.resources.stats().reservedBytes, 0);
    f.reader.dispose();
    f.resources.dispose();
});

test('paged progress accounts only the immutable payload it exposes and keeps each reported size stable', async () => {
    const f = fixture(),
        progress: WindowProgress[] = [];
    f.source.readPaneData = async (request, signal) => {
        const full = await f.base.readPaneData({ ...request, cursor: undefined }, signal);
        return request.cursor ? full : { ...full, panes: [full.panes[0]], coveredWindows: [], nextCursor: 'rest' };
    };
    const result = await f.reader.readWindow(window(), { onProgress: (value) => progress.push(value) });
    assert.equal(progress.length, 1);
    const part = progress[0],
        payload = {
            plan: part.plan,
            version: part.version,
            manifest: part.manifest,
            window: part.window,
            rows: part.rows,
            columns: part.columns,
            panes: part.panes,
            domains: part.domains,
        };
    assert.equal(part.retainedBytes, estimateBytes(payload));
    assert(part.retainedBytes < result.retainedBytes);
    const size = part.retainedBytes;
    result.release();
    assert.equal(part.retainedBytes, size);
    f.reader.dispose();
    f.resources.dispose();
});

test('disposing the first reader preserves peers of every queued shared source method', async () => {
    for (const method of ['describe', 'axis', 'domains', 'locate', 'panes'] as const) {
        const f = fixture(),
            resources = createResourceManager({ maxConcurrent: 1 });
        const a = createWindowReader(f.source, f.plan, resources),
            b = createWindowReader(f.source, f.plan, resources);
        const exportOptions = { partition: 'export' as const, priority: 'export' as const };
        const domainRequest = { version: f.source.version, fieldRefs: ['category', 'value'] };
        const rowKey = (
            await f.base.readAxis({ version: f.source.version, axis: 'row', range: { start: 0, end: 1 } }, new AbortController().signal)
        ).leaves[0].key;
        if (method !== 'describe') await Promise.all([a.describe(), b.describe(exportOptions)]);
        if (method === 'panes') {
            for (const [reader, options] of [
                [a, {}],
                [b, exportOptions],
            ] as const) {
                await reader.readAxis('row', window().rows, options);
                await reader.readAxis('column', window().columns, options);
                await reader.readDomains(domainRequest, options);
            }
        }
        let release!: () => void;
        const blocked = resources.schedule({
            key: 'block-slot',
            version: f.source.version,
            run: () =>
                new Promise<void>((resolve) => {
                    release = resolve;
                }),
        });
        await tick();
        const operation = (reader: typeof a, options = {}) => {
            if (method === 'describe') return reader.describe(options);
            if (method === 'axis') return reader.readAxis('row', window().rows, options);
            if (method === 'domains') return reader.readDomains(domainRequest, options);
            if (method === 'locate') return reader.locate({ version: f.source.version, axis: 'row', key: rowKey }, options);
            return reader.readWindow(window(), options);
        };
        try {
            const first = operation(a),
                rejected = assert.rejects(first, { name: 'AbortError' });
            const second = operation(b, exportOptions);
            for (let attempt = 0; attempt < 100 && resources.stats().consumers < 3; attempt++) await tick();
            assert.equal(resources.stats().consumers, 3, method);
            assert.equal(resources.stats().queued, 1, method);
            a.dispose();
            await rejected;
            release();
            await blocked;
            const result = await second;
            assert.deepEqual(result.version, f.source.version, method);
            if ('release' in result) result.release();
            assert.equal(resources.stats().active, 0, method);
        } finally {
            release();
            a.dispose();
            b.dispose();
            resources.dispose();
            f.reader.dispose();
            f.resources.dispose();
        }
    }
});
