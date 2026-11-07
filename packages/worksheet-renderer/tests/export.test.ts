import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedDataSource } from '../src/core/prepared';
import type { PaneWindow, RenderDataSource, RenderPlan } from '../src/core/types';
import { exportRange } from '../src/export/range';
import { exportViewport } from '../src/export/viewport';
import { serializeSceneToSvg, utf8Bytes } from '../src/export/svg';
import { createResourceManager } from '../src/runtime/resources';
import type { SceneFrame } from '../src/scene/types';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const window = (r0: number, r1: number, c0: number, c1: number): PaneWindow => ({ rows: { start: r0, end: r1 }, columns: { start: c0, end: c1 } });
function fixture() {
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
        domainPlanKey: 'exports',
        layout: { rowHeight: 100, columnWidth: 180 },
    };
    const records = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) records.push({ id: `${r}/${c}`, r: `r${r}`, c: `c${c}`, category: 'category', value: r + c + 1 });
    const base = createPreparedDataSource({
        version: { sourceId: 'export', snapshotId: '1', presentationId: '1' },
        plan,
        records,
        getDatumKey: (record) => String(record.id),
    });
    const requested: PaneWindow[] = [];
    const source: RenderDataSource = {
        ...base,
        async readPaneData(request, signal) {
            requested.push(...request.windows);
            return base.readPaneData(request, signal);
        },
    };
    const resources = createResourceManager();
    return { plan, base, source, resources, requested, context: { plan, source, resources, viewport: { width: 640, height: 480 } } };
}
const emptyFrame = (): SceneFrame => ({ frameId: 7, width: 300, height: 200, rowStart: 0, columnStart: 0, commands: [], hits: [], headers: [] });
const version = { sourceId: 'viewport', snapshotId: '1', presentationId: '1' };
const snapshot = () => ({
    frame: emptyFrame(),
    version,
    requestedVersion: version,
    domainPlanKey: 'view',
    state: 'complete' as const,
    scroll: { x: 12, y: 34 },
});

test('range export fetches never-visited pages once, emits half-open ranks and retains only a file manifest', async () => {
    const f = fixture(),
        seen: PaneWindow[] = [],
        marks: string[] = [];
    const result = await exportRange(f.context, {
        range: 'all',
        mode: 'pages',
        page: { rows: 2, columns: 2 },
        sink(page) {
            assert.equal(page.metadata.bytes, Buffer.byteLength(page.content));
            assert.match(page.content, /<metadata>/);
            assert.match(page.content, /data-command="\[&quot;pane&quot;/);
            seen.push(page.metadata.range!);
            marks.push(...[...page.content.matchAll(/data-command="(\[&quot;pane&quot;[^"]+)"/g)].map((match) => match[1]));
            return { name: `saved-${page.metadata.page}.svg` };
        },
    });
    const expected = [window(0, 2, 0, 2), window(0, 2, 2, 3), window(2, 4, 0, 2), window(2, 4, 2, 3), window(4, 5, 0, 2), window(4, 5, 2, 3)];
    assert.deepEqual(seen, expected);
    assert.deepEqual(f.requested, expected);
    assert.equal(new Set(marks).size, 15);
    assert.equal(marks.length, 15);
    assert.equal(result.files.length, 6);
    assert.equal(result.totals.pages, 6);
    assert.equal(result.files[0].name, 'saved-0.svg');
    assert(result.files.every((file) => !('content' in file)));
    assert(result.totals.reads <= result.estimate.reads);
    assert.equal(f.resources.stats().reservedBytes, 0);
    assert.equal(f.resources.stats().partitions.export, 0);
    f.resources.dispose();
});

test('single range retains exact endpoints and plan/viewport remain fixed while UI inputs change', async () => {
    const f = fixture();
    const widths: number[] = [],
        fonts: string[] = [];
    const result = await exportRange(f.context, {
        range: window(1, 5, 1, 3),
        mode: 'pages',
        page: { rows: 2, columns: 2 },
        async sink(page) {
            widths.push(page.metadata.width);
            fonts.push(page.metadata.fontFamily);
            f.plan.style = { fontFamily: 'changed-font', fontSize: 48 };
            f.plan.layout = { rowHeight: 400, columnWidth: 400 };
            f.context.viewport.width = 999;
            await tick();
        },
    });
    assert.equal(result.files.length, 2);
    assert.equal(widths[0], widths[1]);
    assert.deepEqual(fonts, ['sans-serif', 'sans-serif']);
    assert.equal(result.viewport.width, 640);
    assert.deepEqual(result.range, window(1, 5, 1, 3));
    assert.equal(f.resources.stats().reservedBytes, 0);
    f.resources.dispose();
});

test('source version expiration after a consumed page stops before another page and cleans all export allocations', async () => {
    const f = fixture();
    let pages = 0;
    await assert.rejects(
        exportRange(f.context, {
            range: 'all',
            mode: 'pages',
            page: { rows: 1, columns: 1 },
            sink() {
                pages++;
                f.source.version = { ...f.source.version, snapshotId: '2' };
            },
        }),
        { code: 'version-expired' },
    );
    assert.equal(pages, 1);
    assert.equal(f.requested.length, 1);
    assert.equal(f.resources.stats().reservedBytes, 0);
    assert.equal(f.resources.stats().partitions.export, 0);
    f.resources.dispose();
});

test('cancel settles an ignored sink signal, releases current Scene/window and issues no further reads', async () => {
    const f = fixture(),
        abort = new AbortController();
    let pages = 0;
    await assert.rejects(
        exportRange(
            f.context,
            {
                range: 'all',
                mode: 'pages',
                page: { rows: 1, columns: 1 },
                sink() {
                    pages++;
                    setTimeout(() => abort.abort(), 0);
                    return new Promise(() => {});
                },
            },
            abort.signal,
        ),
        { name: 'AbortError' },
    );
    assert.equal(pages, 1);
    assert.equal(f.requested.length, 1);
    assert.equal(f.resources.stats().reservedBytes, 0);
    assert.equal(f.resources.stats().partitions.export, 0);
    f.resources.dispose();
});

test('cancel returns promptly but retains the physical slot until an uncooperative source settles', async () => {
    const f = fixture(),
        abort = new AbortController();
    f.resources.dispose();
    const resources = createResourceManager({ maxConcurrent: 1 });
    f.context.resources = resources;
    let calls = 0;
    let settle!: (batch: Awaited<ReturnType<RenderDataSource['readPaneData']>>) => void;
    f.source.readPaneData = async () => {
        calls++;
        setTimeout(() => abort.abort(), 0);
        return new Promise((resolve) => { settle = resolve; });
    };
    await assert.rejects(
        exportRange(
            f.context,
            {
                range: window(0, 1, 0, 1),
                sink() {
                    assert.fail('not a complete page');
                },
            },
            abort.signal,
        ),
        { name: 'AbortError' },
    );
    await tick();
    assert.equal(calls, 1);
    assert.equal(resources.stats().active, 1);
    assert.equal(resources.stats().reservedBytes, 0);
    assert.equal(resources.stats().partitions.export, 0);
    const second = new AbortController();
    setTimeout(() => second.abort(), 0);
    await assert.rejects(exportRange(f.context, { range: window(0, 1, 0, 1), sink() {} }, second.signal), { name: 'AbortError' });
    assert.equal(calls, 1, 'Another export must not bypass the occupied physical slot');
    settle(await f.base.readPaneData({ version: f.base.version, windows: [window(0, 1, 0, 1)] }, new AbortController().signal));
    await tick();
    assert.equal(resources.stats().active, 0);
    assert.equal(resources.stats().partitions.export, 0);
    resources.dispose();
});

test('preflight rejects page/read/byte/time/target budgets before any pane read', async () => {
    for (const limits of [{ maxPages: 1 }, { maxReads: 2 }, { maxTotalBytes: 1024 }, { maxElapsedMs: 1 }, { maxPagePixels: 64 }]) {
        const f = fixture();
        await assert.rejects(
            exportRange(f.context, {
                range: 'all',
                mode: 'pages',
                page: { rows: 1, columns: 1 },
                limits,
                sink() {
                    assert.fail('preflight');
                },
            }),
            { code: 'resource-limit' },
        );
        assert.equal(f.requested.length, 0);
        assert.equal(f.resources.stats().reservedBytes, 0);
        f.resources.dispose();
    }
});

test('wrong-version and preview sources are never presented as complete range exports', async () => {
    for (const kind of ['wrong-version', 'preview'] as const) {
        const f = fixture();
        f.source.describe = async (signal) => {
            const manifest = await f.base.describe(signal);
            return kind === 'preview' ? { ...manifest, status: 'preview' } : { ...manifest, version: { ...manifest.version, snapshotId: 'other' } };
        };
        await assert.rejects(
            exportRange(f.context, {
                range: 'all',
                sink() {
                    assert.fail('not complete');
                },
            }),
            { code: kind === 'preview' ? 'incomplete-export' : 'version-expired' },
        );
        assert.equal(f.requested.length, 0);
        assert.equal(f.resources.stats().reservedBytes, 0);
        f.resources.dispose();
    }
});

test('viewport metadata is explicit about placeholders and stale frames always fail', async () => {
    const resources = createResourceManager();
    await assert.rejects(exportViewport({ ...snapshot(), state: 'loading' }, { format: 'svg' }, resources), { code: 'incomplete-export' });
    const page = await exportViewport({ ...snapshot(), state: 'preview' }, { format: 'svg', includePlaceholders: true }, resources);
    assert.equal(page.metadata.status, 'preview');
    assert.equal(page.metadata.includesPlaceholders, true);
    assert.equal(page.metadata.frameId, 7);
    assert.deepEqual(page.metadata.scroll, { x: 12, y: 34 });
    assert.equal(page.metadata.bytes, Buffer.byteLength(page.content));
    for (const state of ['stale', 'error', 'disposed'] as const)
        await assert.rejects(exportViewport({ ...snapshot(), state }, { format: 'svg', includePlaceholders: true }, resources), { code: 'version-expired' });
    await assert.rejects(
        exportViewport({ ...snapshot(), requestedVersion: { ...version, snapshotId: '2' } }, { format: 'svg', includePlaceholders: true }, resources),
        { code: 'version-expired' },
    );
    assert.equal(resources.stats().reservedBytes, 0);
    resources.dispose();
});

test('SVG serialization shares primitives, escapes text/metadata and applies total element/UTF-8 budgets', () => {
    const frame = emptyFrame(),
        clip = { x: 0, y: 0, width: 300, height: 200 };
    frame.commands.push({ id: 'x"<&', clip, primitive: { kind: 'text', x: 2, y: 10, text: '<script>中文 😀 & "\u0000', fontFamily: 'A" B', fill: 'red' } });
    frame.hits = Array(6_000).fill({});
    const result = serializeSceneToSvg(frame, { metadata: { text: '</metadata><script>x</script>' }, maxBytes: 10_000, maxElements: 6 });
    assert.equal(result.elements, 6);
    assert.equal(result.bytes, Buffer.byteLength(result.content));
    assert.equal(utf8Bytes('中文😀\ud800'), Buffer.byteLength('中文😀\ud800'));
    assert.doesNotMatch(result.content, /<script>/);
    assert.match(result.content, /&lt;script&gt;中文 😀 &amp;/);
    assert.match(result.content, /font-family="A&quot; B"/);
    assert.throws(() => serializeSceneToSvg(frame, { maxBytes: 20, maxElements: 6 }), { code: 'resource-limit' });
    assert.throws(() => serializeSceneToSvg(frame, { maxBytes: 10_000, maxElements: 4 }), { code: 'resource-limit' });
    frame.commands[0].primitive = { kind: 'rect', box: clip, fill: 'url(https://host/image)' };
    assert.throws(() => serializeSceneToSvg(frame, { maxBytes: 10_000, maxElements: 6 }), { code: 'unsupported-encoding' });
});

test('viewport PNG uses a bounded temporary Canvas and releases its backing store on success/error', async () => {
    const original = globalThis.document;
    const canvases: any[] = [],
        resources = createResourceManager();
    let fail = false;
    const context = new Proxy({}, { get: () => () => {} });
    (globalThis as any).document = {
        createElement(tag: string) {
            assert.equal(tag, 'canvas');
            const canvas = {
                width: 0,
                height: 0,
                style: {},
                removed: false,
                getContext: () => context,
                toDataURL() {
                    if (fail) throw new Error('encode failed');
                    return 'data:image/png;base64,YWJj';
                },
                remove() {
                    this.removed = true;
                },
            };
            canvases.push(canvas);
            return canvas;
        },
    };
    try {
        const page = await exportViewport({ ...snapshot(), dpr: 2 }, { format: 'png' }, resources);
        assert.equal(page.metadata.bytes, 3);
        assert.equal(page.metadata.dpr, 2);
        assert.equal(page.metadata.width, 300);
        fail = true;
        await assert.rejects(exportViewport(snapshot(), { format: 'png' }, resources), /encode failed/);
        assert(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0 && canvas.removed));
        assert.equal(resources.stats().reservedBytes, 0);
    } finally {
        (globalThis as any).document = original;
        resources.dispose();
    }
});

test('cross-page parent headers are repeated and clipped to each page without changing leaf coverage', async () => {
    const f = fixture();
    f.plan.bindings.push({ fieldRef: 'group', columnKey: 'group', bindingId: 'group', label: 'Group', valueType: 'string', positionType: 'band' });
    f.plan.rows.facets.unshift('group');
    const records = Array.from({ length: 3 }, (_, r) => ({ group: 'Repeated parent', r: `r${r}`, c: 'c0', category: 'category', value: r + 1 }));
    const source = createPreparedDataSource({
        version: { ...version, sourceId: 'nested-export' },
        plan: f.plan,
        records,
        getDatumKey: (record) => String(record.r),
    });
    let pages = 0;
    const result = await exportRange(
        { ...f.context, source },
        {
            range: 'all',
            mode: 'pages',
            page: { rows: 1, columns: 1 },
            sink(page) {
                pages++;
                assert.match(page.content, />▾ Repeate[^<]*<\/text>/);
                const clips = [...page.content.matchAll(/<clipPath[^>]*><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"\/><\/clipPath>/g)];
                assert(clips.length > 0);
                for (const clip of clips) {
                    const [x, y, width, height] = clip.slice(1).map(Number);
                    assert(x >= 0 && y >= 0 && x + width <= page.metadata.width && y + height <= page.metadata.height);
                }
            },
        },
    );
    assert.equal(pages, 3);
    assert.deepEqual(
        result.files.map((file) => file.range),
        [window(0, 1, 0, 1), window(1, 2, 0, 1), window(2, 3, 0, 1)],
    );
    f.resources.dispose();
});

test('actual cursor reads and serialized bytes remain capped even when preflight estimates are smaller', async () => {
    const f = fixture();
    let calls = 0;
    f.source.readPaneData = async () => ({ version: f.source.version, panes: [], coveredWindows: [], nextCursor: `cursor-${++calls}` });
    await assert.rejects(
        exportRange(f.context, {
            range: window(0, 1, 0, 1),
            limits: { maxReads: 6 },
            sink() {
                assert.fail('incomplete page');
            },
        }),
        { code: 'resource-limit' },
    );
    assert.equal(calls, 2);
    assert.equal(f.resources.stats().reservedBytes, 0);
    f.resources.dispose();
    const g = fixture();
    await assert.rejects(
        exportRange(g.context, {
            range: window(0, 1, 0, 1),
            limits: { maxPageBytes: 512 },
            sink() {
                assert.fail('oversized page');
            },
        }),
        { code: 'resource-limit' },
    );
    assert.equal(g.resources.stats().reservedBytes, 0);
    assert.equal(g.resources.stats().partitions.export, 0);
    g.resources.dispose();
});

test('elapsed-time and font revision limits abort a fixed range export', async () => {
    const f = fixture();
    await assert.rejects(
        exportRange(f.context, {
            range: window(0, 1, 0, 1),
            limits: { maxElapsedMs: 150 },
            sink() {
                return new Promise(() => {});
            },
        }),
        { code: 'resource-limit' },
    );
    assert.equal(f.resources.stats().reservedBytes, 0);
    f.resources.dispose();
    const g = fixture();
    let revision = 1;
    await assert.rejects(
        exportRange(
            { ...g.context, fontRevision: () => revision },
            {
                range: window(0, 1, 0, 1),
                sink() {
                    revision++;
                },
            },
        ),
        { code: 'version-expired' },
    );
    assert.equal(g.resources.stats().reservedBytes, 0);
    g.resources.dispose();
});

test('concurrent exports deduplicate provider reads and cancelling one does not cancel the other', async () => {
    const f = fixture(),
        abort = new AbortController();
    let resolve!: (value: any) => void,
        providerSignal!: AbortSignal,
        calls = 0;
    f.source.describe = async (signal) => {
        calls++;
        providerSignal = signal;
        return new Promise((finish) => {
            resolve = finish;
        });
    };
    const options = { range: window(0, 1, 0, 1), sink() {} };
    const first = exportRange(f.context, options, abort.signal),
        second = exportRange(f.context, options);
    await tick();
    const rejected = assert.rejects(first, { name: 'AbortError' });
    abort.abort();
    await rejected;
    assert.equal(providerSignal.aborted, false);
    resolve(await f.base.describe(new AbortController().signal));
    const manifest = await second;
    assert.equal(manifest.files.length, 1);
    assert.equal(calls, 1);
    assert(f.resources.stats().deduplicated >= 1);
    assert.equal(f.resources.stats().reservedBytes, 0);
    assert.equal(f.resources.stats().partitions.export, 0);
    f.resources.dispose();
});

test('empty logical data exports one explicit empty range page and empty viewport stays exportable', async () => {
    const f = fixture(),
        source = createPreparedDataSource({ version: { ...version, sourceId: 'empty' }, plan: f.plan, records: [] });
    let calls = 0;
    const manifest = await exportRange(
        { ...f.context, source },
        {
            range: 'all',
            mode: 'pages',
            sink(page) {
                calls++;
                assert.match(page.content, /<svg /);
                assert.equal(page.metadata.includesPlaceholders, false);
            },
        },
    );
    assert.equal(calls, 1);
    assert.deepEqual(manifest.range, window(0, 0, 0, 0));
    assert.equal(manifest.files.length, 1);
    const page = await exportViewport(snapshot(), { format: 'svg' }, f.resources);
    assert.equal(page.metadata.status, 'complete');
    assert.equal(f.resources.stats().reservedBytes, 0);
    f.resources.dispose();
});
