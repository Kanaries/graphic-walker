import test from 'node:test';
import assert from 'node:assert/strict';
import { createB1Fixtures, createBenchmarkFixture, createB4Plan, BENCHMARK_SEED } from '../bench/fixtures';
import { prepareBenchmark, renderWindow, distribution } from '../bench/pipeline';
import { createB4Source } from '../bench/programmatic';
import { createPreparedDataSource } from '../src/core/prepared';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { domainRequestForWindow } from '../src/core/domains';
import { buildScene } from '../src/scene/build';
import { selectionTarget } from '../src/runtime/types';
import { assertCompleteWindow } from '../src/core/validateWindow';
const signal = new AbortController().signal;

test('B1 preserves both-axis depth, sparse joint paths and exact selection tuples', async () => {
    for (const fixture of createB1Fixtures()) {
        const adapted = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns });
        assert.ok(adapted.plan, JSON.stringify(adapted.diagnostics));
        const plan = adapted.plan, version = { sourceId: fixture.id, snapshotId: '1', presentationId: '1' };
        const source = createPreparedDataSource({ plan, version, records: fixture.records, getDatumKey: fixture.getDatumKey });
        const manifest = await source.describe(signal);
        assert.equal(manifest.rowLeafCount, fixture.expected.rowLeaves, fixture.id);
        assert.equal(manifest.columnLeafCount, fixture.expected.columnLeaves, fixture.id);
        assert.equal(manifest.nonEmptyPaneCount, fixture.expected.nonEmptyPanes, fixture.id);
        if (fixture.expected.rowFacets) assert.equal(plan.rows.facets.length, fixture.expected.rowFacets);
        if (fixture.expected.columnFacets) assert.equal(plan.columns.facets.length, fixture.expected.columnFacets);
        const window = { rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } };
        const [rows, columns, panes] = await Promise.all([source.readAxis({ version, axis: 'row', range: window.rows }, signal), source.readAxis({ version, axis: 'column', range: window.columns }, signal), source.readPaneData({ version, windows: [window] }, signal)]);
        const domains = await source.readDomains(domainRequestForWindow(plan, version, rows.leaves, columns.leaves), signal);
        assertCompleteWindow({ plan, version, manifest, window, rows, columns, panes, domains });
        const frame = buildScene({ plan, rows, columns, panes, domains, width: 1440, height: 900, scrollX: 0, scrollY: 0, frameId: 1 });
        assert.ok(frame.hits.length > 0, fixture.id);
        if (fixture.expected.exactTuples) {
            const selected = frame.hits.map((hit) => selectionTarget(hit, plan));
            const tuple = (target: typeof selected[number]) => ['Region', 'Product'].map((key) => target.values.find((value) => plan.bindings.find((binding) => binding.fieldRef === value.fieldRef)?.columnKey === key)?.raw);
            assert.deepEqual(selected.map(tuple), fixture.expected.exactTuples);
            assert.equal(panes.panes.length, 2, 'Two tuples must not create four records');
        }
    }
});

test('reference B2 and B3 contain real promised record counts and six levels per axis', () => {
    const b2 = createBenchmarkFixture('B2');
    assert.equal(b2.records.length, 200_000); assert.equal(b2.expected.nonEmptyPanes, 10_000);
    assert.equal(b2.expected.rowDepth, 6); assert.equal(b2.expected.columnDepth, 6);
    const b3 = createBenchmarkFixture('B3');
    assert.equal(b3.records.length, 1_000_000); assert.equal(b3.expected.rowLeaves, 100_000);
    assert.equal(b3.expected.columnLeaves, 1000); assert.equal(b3.expected.logicalSlots, 100_000_000);
    const rowCounts = new Uint16Array(100_000), columnCounts = new Uint16Array(1000);
    for (const record of b3.records) { rowCounts[Number(record.row)]++; columnCounts[Number(record.column)]++; }
    assert.ok(rowCounts.every((count) => count === 10)); assert.ok(columnCounts.every((count) => count === 1000));
    assert.equal(b3.records[999_999].id, 'B3:99999:999:0'); assert.equal(b3.seed, BENCHMARK_SEED);
});

test('B2 and B5 share deterministic semantics and request bounded real windows', async () => {
    const b2 = createBenchmarkFixture('B2', { smoke: true }), b5 = createBenchmarkFixture('B5', { smoke: true });
    assert.equal(b2.records.length, b5.records.length);
    for (let index = 0; index < b2.records.length; index++) { assert.equal(b2.records[index].x, b5.records[index].x); assert.equal(b2.records[index].y, b5.records[index].y); }
    const prepared = await prepareBenchmark('B2', { smoke: true });
    const result = await renderWindow(prepared, b2.windowForSample(7));
    assert.ok(result.counts.logicalPanes <= 100); assert.ok(result.counts.loadedPanes > 0 && result.counts.loadedRecords > 0);
    assert.ok(result.counts.loadedRecords <= 20_000); assert.ok(result.counts.marks > 0);
});

test('B5 stress supplies and draws five thousand marks in its first hundred panes', async () => {
    const prepared = await prepareBenchmark('B5', { smoke: true, svgStress: true });
    const result = await renderWindow(prepared, { rows: { start: 0, end: 10 }, columns: { start: 0, end: 10 } });
    assert.equal(result.counts.loadedPanes, 100); assert.equal(result.counts.loadedRecords, 5000); assert.equal(result.counts.marks, 5000);
});

test('B4 reads real far-edge records without materializing its logical matrix', async () => {
    const plan = createB4Plan(), source = createB4Source(plan), version = source.version, manifest = await source.describe(signal);
    assert.equal(manifest.rowLeafCount, 1_000_000_000);
    const window = { rows: { start: manifest.rowLeafCount - 2, end: manifest.rowLeafCount }, columns: { start: manifest.columnLeafCount - 2, end: manifest.columnLeafCount } };
    const [rows, columns, panes] = await Promise.all([source.readAxis({ version, axis: 'row', range: window.rows }, signal), source.readAxis({ version, axis: 'column', range: window.columns }, signal), source.readPaneData({ version, windows: [window] }, signal)]);
    const domains = await source.readDomains(domainRequestForWindow(plan, version, rows.leaves, columns.leaves), signal);
    assertCompleteWindow({ plan, version, manifest, window, rows, columns, panes, domains });
    assert.equal(panes.panes.length, 4); assert.equal(panes.panes[3].records[0].datumKey, 'B4:999999999:999999');
    assert.equal((await source.locate({ version, axis: 'row', key: rows.leaves[1].key }, signal)).status, 'found');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(source.readPaneData({ version, windows: [window] }, controller.signal));
});

test('benchmark quantiles use nearest-rank percentiles with explicit sample counts', () => {
    assert.deepEqual(distribution([5, 1, 4, 2, 3]), { n: 5, p50: 3, p95: 5, maximum: 5 });
    assert.deepEqual(distribution([]), { n: 0, p50: null, p95: null, maximum: null });
});
