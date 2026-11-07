import { createPreparedDataSource } from '../src/core/prepared';
import { domainRequestForWindow } from '../src/core/domains';
import { assertCompleteWindow } from '../src/core/validateWindow';
import type { PaneWindow, RenderDataManifest, RenderDataSource, RenderPlan } from '../src/core/types';
import { buildScene, layoutMetrics } from '../src/scene/build';
import { adaptBenchmarkFixture, BENCHMARK_VIEWPORT, createB4Plan, createBenchmarkFixture, type BenchmarkCase, type BenchmarkFixture } from './fixtures';
import { createB4Source } from './programmatic';

export interface PreparedBenchmark {
    id: string;
    fixture?: BenchmarkFixture;
    plan: RenderPlan;
    source: RenderDataSource;
    manifest: RenderDataManifest;
    preparation: { inputMs: number; adapterMs: number; indexMs: number; manifestMs: number; totalMs: number };
}
export async function prepareBenchmark(id: BenchmarkCase | 'B4', options: { smoke?: boolean; svgStress?: boolean; seed?: number; phase?: (name: string) => void } = {}): Promise<PreparedBenchmark> {
    const started = performance.now();
    options.phase?.('before-input');
    const fixture = id === 'B4' ? undefined : createBenchmarkFixture(id, options);
    const afterInput = performance.now(); options.phase?.('after-input');
    const plan = fixture ? adaptBenchmarkFixture(fixture) : createB4Plan();
    const afterAdapter = performance.now(); options.phase?.('after-adapter');
    const source = fixture ? createPreparedDataSource({ plan, records: fixture.records, version: { sourceId: fixture.id, snapshotId: String(fixture.seed), presentationId: '1' }, getDatumKey: fixture.getDatumKey }) : createB4Source(plan);
    const afterIndex = performance.now(); options.phase?.('after-index');
    const manifest = await source.describe(new AbortController().signal);
    const end = performance.now(); options.phase?.('after-manifest');
    if (fixture) {
        for (const [actual, expected] of [[manifest.rowLeafCount, fixture.expected.rowLeaves], [manifest.columnLeafCount, fixture.expected.columnLeaves], [manifest.recordCount, fixture.expected.records], [manifest.nonEmptyPaneCount, fixture.expected.nonEmptyPanes]]) if (actual !== expected) throw new Error(`Fixture manifest mismatch: ${actual} != ${expected}`);
    }
    return { id: fixture?.id ?? 'B4', fixture, plan, source, manifest, preparation: { inputMs: afterInput - started, adapterMs: afterAdapter - afterInput, indexMs: afterIndex - afterAdapter, manifestMs: end - afterIndex, totalMs: end - started } };
}
export function sampleWindow(prepared: PreparedBenchmark, sample: number): PaneWindow {
    if (prepared.fixture) return prepared.fixture.windowForSample(sample);
    const row = sample % 3 === 0 ? 0 : sample % 3 === 1 ? 500_000_000 + sample : prepared.manifest.rowLeafCount - 8;
    const column = sample % 2 === 0 ? 0 : prepared.manifest.columnLeafCount - 10;
    return { rows: { start: row, end: row + 8 }, columns: { start: column, end: column + 10 } };
}
export async function renderWindow(prepared: PreparedBenchmark, window: PaneWindow, frameId = 1, phase?: (name: string) => void) {
    const signal = new AbortController().signal, version = prepared.source.version;
    const started = performance.now(); phase?.('read-start');
    const [rows, columns, panes] = await Promise.all([
        prepared.source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        prepared.source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        prepared.source.readPaneData({ version, windows: [window] }, signal),
    ]);
    const domains = await prepared.source.readDomains(domainRequestForWindow(prepared.plan, version, rows.leaves, columns.leaves), signal);
    const afterRead = performance.now(); phase?.('read-end');
    assertCompleteWindow({ plan: prepared.plan, version, manifest: prepared.manifest, window, rows, columns, panes, domains });
    const afterValidation = performance.now(); phase?.('validation-end');
    const layout = layoutMetrics(prepared.plan, BENCHMARK_VIEWPORT.width, BENCHMARK_VIEWPORT.height);
    const frame = buildScene({ plan: prepared.plan, rows, columns, panes, domains, width: BENCHMARK_VIEWPORT.width, height: BENCHMARK_VIEWPORT.height, scrollX: window.columns.start * layout.columnWidth, scrollY: window.rows.start * layout.rowHeight, frameId });
    const end = performance.now(); phase?.('scene-end');
    return { frame, timing: { readMs: afterRead - started, validationMs: afterValidation - afterRead, sceneMs: end - afterValidation, totalMs: end - started }, counts: { logicalPanes: (window.rows.end - window.rows.start) * (window.columns.end - window.columns.start), loadedPanes: panes.panes.length, loadedRecords: panes.panes.reduce((count, pane) => count + pane.records.length, 0), marks: frame.hits.length, commands: frame.commands.length, rowHeaders: rows.ancestors.length, columnHeaders: columns.ancestors.length } };
}
export function distribution(values: readonly number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
    return { n: sorted.length, p50: at(0.5), p95: at(0.95), maximum: sorted.at(-1) ?? null };
}
