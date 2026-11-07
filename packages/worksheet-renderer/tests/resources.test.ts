import assert from 'node:assert/strict';
import test from 'node:test';
import { createResourceManager, estimateBytes } from '../src/runtime/resources';
const version = { sourceId: 'resource', snapshotId: 'data', presentationId: 'display' };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

test('the shared scheduler bounds physical reads and serves metadata before continuation, overscan and export', async () => {
    const resources = createResourceManager({ maxConcurrent: 1 }),
        first = deferred<number>(),
        order: string[] = [];
    const blocking = resources.schedule({ version, key: 'first', run: () => first.promise });
    await tick();
    const requests = (['export', 'overscan', 'continuation', 'metadata'] as const).map((priority) =>
        resources.schedule({
            version,
            key: priority,
            priority,
            run: async () => {
                order.push(priority);
                return 1;
            },
        }),
    );
    assert.equal(resources.stats().active, 1);
    assert.equal(resources.stats().queued, 4);
    first.resolve(1);
    await Promise.all([blocking, ...requests]);
    assert.deepEqual(order, ['metadata', 'continuation', 'overscan', 'export']);
    resources.dispose();
});

test('deduplicated consumers cancel independently and the last cancellation ignores a late physical result', async () => {
    const resources = createResourceManager({ maxConcurrent: 1 }),
        one = new AbortController(),
        two = new AbortController(),
        late = deferred<number>();
    let calls = 0;
    const request = {
        version,
        key: 'shared',
        run: async (_signal: AbortSignal) => {
            calls++;
            return late.promise;
        },
    };
    const a = resources.schedule({ ...request, signal: one.signal }),
        b = resources.schedule({ ...request, signal: two.signal });
    await tick();
    const aRejected = assert.rejects(a, { name: 'AbortError' });
    one.abort();
    await aRejected;
    assert.equal(calls, 1);
    assert.equal(resources.stats().consumers, 1);
    late.resolve(3);
    assert.equal(await b, 3);
    assert.equal(resources.stats().active, 0);
    const ignored = deferred<number>(),
        cancelled = new AbortController();
    const c = resources.schedule({ version, key: 'ignored', signal: cancelled.signal, run: () => ignored.promise });
    await tick();
    const cRejected = assert.rejects(c, { name: 'AbortError' });
    cancelled.abort();
    await cRejected;
    let nextStarted = false;
    const next = resources.schedule({
        version,
        key: 'next',
        run: async () => {
            nextStarted = true;
            return 9;
        },
    });
    await tick();
    assert.equal(nextStarted, false);
    assert.equal(resources.stats().active, 1);
    ignored.resolve(7);
    assert.equal(await next, 9);
    resources.dispose();
});

test('old display cancellation preserves an export consumer of the same immutable version', async () => {
    const resources = createResourceManager(),
        result = deferred<number>();
    let aborted = false;
    const run = (signal: AbortSignal) => {
        signal.addEventListener('abort', () => {
            aborted = true;
        });
        return result.promise;
    };
    const display = resources.schedule({ version, key: 'same', run }),
        exportRead = resources.schedule({ version, key: 'same', partition: 'export', run });
    await tick();
    const rejected = assert.rejects(display, { name: 'AbortError' });
    resources.cancelVersion(version);
    await rejected;
    assert.equal(aborted, false);
    result.resolve(4);
    assert.equal(await exportRead, 4);
    resources.dispose();
});

test('full read versions separate requests and byte reservations fail atomically after evicting expendable cache', async () => {
    const resources = createResourceManager({ maxBytes: 1000, maxEntries: 2 });
    let calls = 0;
    await Promise.all(
        [version, { ...version, presentationId: 'sorted' }].map((current) =>
            resources.schedule({ version: current, key: 'range', run: async () => ++calls }),
        ),
    );
    assert.equal(calls, 2);
    resources.reserve('displayed', 500);
    resources.cachePut('data', 'old-export', {}, { bytes: 200, partition: 'export' });
    resources.cachePut('members', 'visible', {}, { bytes: 200 });
    resources.reserve('candidate', 400);
    assert.equal(resources.cacheGet('data', 'old-export', 'export'), undefined);
    assert.equal(resources.stats().reservedBytes, 900);
    assert.throws(() => resources.reserve('displayed', 700), { code: 'resource-limit' });
    assert.equal(resources.stats().reservedBytes, 900);
    resources.release('candidate');
    resources.release('candidate');
    assert.equal(resources.stats().reservedBytes, 500);
    resources.dispose();
    assert.equal(resources.stats().bytes, 0);
});

test('layer and entry budgets remain bounded on insertion and replacement', () => {
    const resources = createResourceManager({ maxBytes: 1000, maxEntries: 2 });
    for (const key of ['a', 'b', 'c', 'c']) resources.cachePut('data', key, { key }, { bytes: 100 });
    assert.equal(resources.stats().layers.data.entries, 2);
    assert.ok(resources.stats().bytes > 200);
    assert.ok(resources.stats().bytes <= 1000);
    assert.equal(resources.reserve('optional', 1001, { required: false }), false);
    assert.equal(resources.stats().reservedBytes, 0);
    assert(estimateBytes({ record: ['longer string', 1, true] }) > estimateBytes({}));
    resources.dispose();
});

test('cache budgets include entry keys and derived Map identities even with an explicit value size', () => {
    const resources = createResourceManager({ maxBytes: 1024 });
    assert.equal(resources.cachePut('metadata', 'x'.repeat(1024 * 1024), {}, { bytes: 1 }), false);
    assert.equal(resources.stats().bytes, 0);
    assert.equal(resources.cachePut('metadata', 'short', {}, { bytes: 1 }), true);
    assert.ok(resources.stats().bytes > 128);
    resources.dispose();
});

test('a source timeout rejects consumers without opening extra physical slots for an uncooperative read', async () => {
    const resources = createResourceManager({ maxConcurrent: 1, requestTimeoutMs: 15 }),
        pending = deferred<number>();
    let calls = 0;
    const first = resources.schedule({ version, key: 'hang', run: () => pending.promise });
    await assert.rejects(first, { code: 'read-timeout' });
    const next = resources.schedule({ version, key: 'queued', run: async () => ++calls });
    await assert.rejects(next, { code: 'read-timeout' });
    assert.equal(calls, 0);
    assert.equal(resources.stats().active, 1);
    pending.resolve(1);
    await tick();
    assert.equal(resources.stats().active, 0);
    resources.dispose();
});

test('byte estimates share immutable string contents while charging each reference and each unique value', () => {
    const shared = 'shared pane identity '.repeat(100),
        unique = 'unique pane identity '.repeat(100);
    const one = estimateBytes([shared]),
        repeated = estimateBytes([shared, shared]);
    assert(repeated > one);
    assert(repeated - one < 100);
    assert.equal(estimateBytes([shared, unique]) - repeated, 16 + unique.length * 2);
    const record = { [shared]: shared };
    assert(estimateBytes(record) < shared.length * 4);
    const structure = estimateBytes([shared, shared], { sharedStrings: true });
    assert(structure < 200);
    assert(structure > estimateBytes([], { sharedStrings: true }));
    assert.equal(structure, estimateBytes([shared, unique], { sharedStrings: true }));
});

test('byte estimates bound cycles and reuse one object regardless of repeated graph references', () => {
    const object: any = { value: 'retained' };
    object.self = object;
    const cost = estimateBytes(object);
    assert(Number.isFinite(cost));
    assert(cost > 32);
    assert.equal(estimateBytes({ a: object, b: object }) - estimateBytes({ a: object }), 16 + 8 + 16 + 2);
    assert(estimateBytes(object, { sharedStrings: true }) < cost);
});

test('live owners share one immutable base while exclusives and cache copies remain independently charged', () => {
    const resources = createResourceManager({ maxBytes: 1600 }),
        base = {};
    assert.equal(
        resources.reserve('committed', 100, {
            shared: [
                { value: base, bytes: 700 },
                { value: base, bytes: 700 },
            ],
        }),
        true,
    );
    assert.equal(resources.stats().reservedBytes, 800);
    assert.equal(resources.reserve('candidate', 150, { shared: [{ value: base, bytes: 700 }] }), true);
    assert.equal(resources.stats().reservedBytes, 950);
    assert.equal(resources.stats().bytes, 950);
    assert.equal(resources.cachePut('geometry', 'same', base, { bytes: 100 }), true);
    const cacheBytes = resources.stats().layers.geometry.bytes;
    assert(cacheBytes > 100);
    assert.equal(resources.stats().bytes, 950 + cacheBytes);
    resources.release('committed');
    assert.equal(resources.stats().reservedBytes, 850);
    resources.release('candidate');
    assert.equal(resources.stats().reservedBytes, 0);
    assert.equal(resources.stats().bytes, cacheBytes);
    assert.equal(resources.stats().peakBytes, 950 + cacheBytes);
    resources.dispose();
    assert.equal(resources.stats().bytes, 0);
    assert.equal(resources.stats().reservedBytes, 0);
});

test('replacing owners computes unique-base deltas atomically and rejects inconsistent identity sizes', () => {
    const resources = createResourceManager({ maxBytes: 1000 }),
        old = {},
        next = {};
    resources.reserve('frame', 100, { shared: [{ value: old, bytes: 700 }] });
    // Replacing the sole owner may use the bytes released from its old base.
    resources.reserve('frame', 100, { shared: [{ value: next, bytes: 800 }] });
    assert.equal(resources.stats().reservedBytes, 900);
    assert.equal(resources.reserve('frame', 300, { shared: [{ value: next, bytes: 800 }], required: false }), false);
    assert.equal(resources.stats().reservedBytes, 900);
    assert.equal(resources.stats().peakBytes, 900);
    assert.throws(() => resources.reserve('frame', 300, { shared: [{ value: next, bytes: 800 }] }), { code: 'resource-limit' });
    assert.throws(() => resources.reserve('other', 0, { shared: [{ value: next, bytes: 799 }] }), /same byte count/);
    assert.equal(resources.stats().reservedBytes, 900);
    resources.reserve('peer', 50, { shared: [{ value: next, bytes: 800 }] });
    assert.equal(resources.stats().reservedBytes, 950);
    resources.reserve('frame', 100);
    assert.equal(resources.stats().reservedBytes, 950);
    resources.release('peer');
    assert.equal(resources.stats().reservedBytes, 100);
    assert.throws(() => resources.reserve('reused-identity', 0, { shared: [{ value: next, bytes: 799 }] }), /same byte count/);
    resources.release('frame');
    resources.release('frame');
    assert.equal(resources.stats().bytes, 0);
    resources.dispose();
});

test('shared base partition attribution follows live display ownership and moves to export after release', () => {
    const resources = createResourceManager({ maxBytes: 1000 }),
        base = {};
    resources.reserve('export', 40, { partition: 'export', shared: [{ value: base, bytes: 600 }] });
    assert.deepEqual(resources.stats().partitions, { display: 0, export: 640 });
    resources.reserve('display', 30, { partition: 'display', shared: [{ value: base, bytes: 600 }] });
    assert.deepEqual(resources.stats().partitions, { display: 630, export: 40 });
    resources.reserve('display', 30, { partition: 'export', shared: [{ value: base, bytes: 600 }] });
    assert.deepEqual(resources.stats().partitions, { display: 0, export: 670 });
    resources.reserve('display', 30, { partition: 'display', shared: [{ value: base, bytes: 600 }] });
    resources.release('display');
    assert.deepEqual(resources.stats().partitions, { display: 0, export: 640 });
    const stats = resources.stats();
    assert.equal(stats.partitions.display + stats.partitions.export, stats.bytes);
    resources.dispose();
    assert.deepEqual(resources.stats().partitions, { display: 0, export: 0 });
});

test('an impossible optional shared reservation preserves both its old owner and unrelated hot cache', () => {
    const resources = createResourceManager({ maxBytes: 1800 }),
        base = {},
        oversized = {};
    resources.reserve('frame', 100, { shared: [{ value: base, bytes: 700 }] });
    resources.cachePut('data', 'hot', { complete: true }, { bytes: 100 });
    const before = resources.stats();
    assert.equal(resources.reserve('frame', 100, { shared: [{ value: oversized, bytes: 1800 }], required: false }), false);
    assert.equal(resources.stats().bytes, before.bytes);
    assert.equal(resources.stats().reservedBytes, before.reservedBytes);
    assert.equal(resources.stats().evictions, before.evictions);
    assert.deepEqual(resources.cacheGet('data', 'hot'), { complete: true });
    // A failed proposal does not establish an identity size or retain a shared reference.
    resources.reserve('frame', 100, { shared: [{ value: oversized, bytes: 800 }] });
    assert.equal(resources.stats().reservedBytes, 900);
    resources.release('frame');
    assert.equal(resources.stats().reservedBytes, 0);
    resources.dispose();
});

test('shared reservations reject invalid entries and unsafe combined budgets without altering existing owners', () => {
    const resources = createResourceManager({ maxBytes: 1000 }),
        base = {};
    resources.reserve('frame', 100, { shared: [{ value: base, bytes: 100 }] });
    for (const shared of [
        [{ value: null, bytes: 1 }],
        [{ value: base, bytes: -1 }],
        [{ value: base, bytes: 0.5 }],
        [
            { value: {}, bytes: 2 },
            { value: base, bytes: 101 },
        ],
    ])
        assert.throws(() => resources.reserve('frame', 0, { shared: shared as any }), /invalid-option/);
    assert.equal(
        resources.reserve('frame', Number.MAX_SAFE_INTEGER, { required: false, shared: [{ value: {}, bytes: Number.MAX_SAFE_INTEGER }] }),
        false,
    );
    assert.equal(resources.stats().reservedBytes, 200);
    resources.dispose();
    assert.throws(() => resources.reserve('frame', 0, { shared: [{ value: base, bytes: 100 }] }), { name: 'AbortError' });
});

test('rolling overlapping frame reservations preserve hot cache without counting the same pane geometry twice', () => {
    const resources = createResourceManager({ maxBytes: 1600 }),
        panes = Array.from({ length: 12 }, () => ({}));
    resources.cachePut('geometry', 'hot', {}, { bytes: 300 });
    const cacheBytes = resources.stats().bytes;
    let committed = 'frame-0';
    resources.reserve(committed, 20, { shared: panes.slice(0, 8).map((value) => ({ value, bytes: 80 })) });
    for (let step = 1; step <= 4; step++) {
        const candidate = `frame-${step}`;
        resources.reserve(candidate, 20, { shared: panes.slice(step, step + 8).map((value) => ({ value, bytes: 80 })) });
        assert.equal(resources.stats().reservedBytes, 9 * 80 + 40);
        assert.equal(resources.stats().bytes, cacheBytes + 9 * 80 + 40);
        resources.release(committed);
        committed = candidate;
        assert.equal(resources.stats().reservedBytes, 8 * 80 + 20);
        assert.equal(resources.stats().evictions, 0);
        assert.deepEqual(resources.cacheGet('geometry', 'hot'), {});
    }
    resources.release(committed);
    assert.equal(resources.stats().bytes, cacheBytes);
    resources.dispose();
});
