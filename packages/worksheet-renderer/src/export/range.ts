import { sameVersion } from '../core/keys';
import type { PaneWindow, ReadVersion, RenderDataManifest, RenderDataSource, RenderPlan } from '../core/types';
import { createWindowReader, type WindowReader, type WindowReadResult } from '../runtime/reader';
import { buildScene, layoutMetrics, type LayoutMetrics } from '../scene/build';
import { serializeSceneToSvg } from './svg';
import { abortReason, checkDimensions, exportTask, ExportError, limitsFor, retainedBytes, withAbort } from './shared';
import type { ExportEstimate, ExportLimits, ExportPageMetadata, ExportViewport, RangeExportContext, RangeExportManifest, RangeExportOptions } from './types';

interface ExportPlan {
    range: PaneWindow;
    page: { rows: number; columns: number };
    estimate: ExportEstimate;
    metrics: LayoutMetrics;
}
const copyWindow = (window: PaneWindow): PaneWindow => ({ rows: { ...window.rows }, columns: { ...window.columns } });
function pageDimensions(window: PaneWindow, metrics: LayoutMetrics) {
    return {
        width: Math.max(1, metrics.headerWidth + metrics.legendWidth + (window.columns.end - window.columns.start) * metrics.columnWidth),
        height: Math.max(1, metrics.headerHeight + (window.rows.end - window.rows.start) * metrics.rowHeight),
    };
}
function preflight(manifest: RenderDataManifest, plan: RenderPlan, viewport: ExportViewport, options: RangeExportOptions, limits: ExportLimits): ExportPlan {
    checkDimensions(viewport.width, viewport.height, limits);
    if (options.range !== 'all' && (!options.range?.rows || !options.range?.columns))
        throw new ExportError('source-contract-violation', 'Export requires a logical rank range or all');
    const range =
        options.range === 'all'
            ? { rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } }
            : copyWindow(options.range);
    for (const [axis, total] of [
        [range.rows, manifest.rowLeafCount],
        [range.columns, manifest.columnLeafCount],
    ] as const)
        if (!Number.isSafeInteger(axis.start) || !Number.isSafeInteger(axis.end) || axis.start < 0 || axis.end < axis.start || axis.end > total)
            throw new ExportError('source-contract-violation', 'Export requires valid half-open rank ranges within the fixed manifest');
    if (options.mode !== undefined && !['single', 'pages'].includes(options.mode))
        throw new ExportError('unsupported-encoding', 'Export mode must be single or pages');
    const metrics = Object.freeze({ ...layoutMetrics(plan, viewport.width, viewport.height) });
    const rows = range.rows.end - range.rows.start,
        columns = range.columns.end - range.columns.start;
    const page =
        options.mode === 'pages'
            ? {
                  rows: options.page?.rows ?? Math.max(1, Math.floor((viewport.height - metrics.headerHeight) / metrics.rowHeight)),
                  columns: options.page?.columns ?? Math.max(1, Math.floor((viewport.width - metrics.headerWidth - metrics.legendWidth) / metrics.columnWidth)),
              }
            : { rows: Math.max(1, rows), columns: Math.max(1, columns) };
    if (![page.rows, page.columns].every((value) => Number.isSafeInteger(value) && value > 0))
        throw new ExportError('source-contract-violation', 'Page row/column counts must be positive safe integers');
    if (options.mode !== 'pages' && options.page) throw new ExportError('unsupported-encoding', 'Page counts require pages mode');
    const rowPages = Math.max(1, Math.ceil(rows / page.rows)),
        columnPages = Math.max(1, Math.ceil(columns / page.columns));
    if (rowPages > limits.maxPages / columnPages) throw new ExportError('resource-limit', 'Export page-count preflight exceeds its hard limit');
    const pages = rowPages * columnPages,
        maxRows = Math.min(rows, page.rows),
        maxColumns = Math.min(columns, page.columns);
    if (Math.max(maxRows, maxColumns) > manifest.capabilities.maxAxisWindow || maxRows * maxColumns > 20_000)
        throw new ExportError('resource-limit', 'An export page exceeds the bounded source/window capacity');
    const maximum = pageDimensions({ rows: { start: 0, end: maxRows }, columns: { start: 0, end: maxColumns } }, metrics);
    checkDimensions(maximum.width, maximum.height, limits);
    // This is an estimate, not a claim of uniform data density. Actual reads, bytes and wall time are also capped.
    const logicalSlots = Math.max(1, manifest.rowLeafCount * manifest.columnLeafCount),
        density = manifest.recordCount / logicalSlots;
    const pageSlots = maxRows * maxColumns,
        estimatedCommands =
            256 + (plan.rows.facets.length + plan.columns.facets.length + 2) * (maxRows + maxColumns) * 2 + pageSlots * 24 + pageSlots * density;
    const estimate = { pages, reads: 1 + pages * 4, bytes: Math.ceil(pages * Math.min(limits.maxPageElements, estimatedCommands) * 256), workMs: pages * 100 };
    if (estimate.reads > limits.maxReads || estimate.bytes > limits.maxTotalBytes || estimate.workMs > limits.maxElapsedMs)
        throw new ExportError('resource-limit', 'Export estimated reads, output bytes or work time exceed the preflight budget');
    return { range, page, estimate, metrics };
}
function* pagesFor(range: PaneWindow, page: { rows: number; columns: number }): Generator<PaneWindow> {
    const rowEnd = Math.max(range.rows.end, range.rows.start + 1),
        columnEnd = Math.max(range.columns.end, range.columns.start + 1);
    for (let row = range.rows.start; row < rowEnd; row += page.rows)
        for (let column = range.columns.start; column < columnEnd; column += page.columns)
            yield {
                rows: { start: row, end: Math.min(range.rows.end, row + page.rows) },
                columns: { start: column, end: Math.min(range.columns.end, column + page.columns) },
            };
}
function estimateScene(input: WindowReadResult): number {
    const { plan, rows, columns, panes } = input;
    const slots = rows.leaves.length * columns.leaves.length,
        maximumTicks = Math.max(3, ...Object.values(plan.axes ?? {}).map((axis) => axis.tickCount ?? 10));
    const longestKey = Math.max(0, ...rows.leaves.map((leaf) => leaf.key.length)) + Math.max(0, ...columns.leaves.map((leaf) => leaf.key.length));
    let bytes =
        64 * 1024 + slots * (maximumTicks * 4 + 8) * (512 + longestKey * 2) + (rows.ancestors.length + columns.ancestors.length) * (1024 + longestKey * 4);
    for (const pane of panes.panes)
        for (const record of pane.records) {
            let label = 0;
            for (const binding of plan.bindings)
                if (Object.prototype.hasOwnProperty.call(record.values, binding.columnKey))
                    label += binding.label.length + String(record.values[binding.rawColumnKey ?? binding.columnKey] ?? '∅').length + 4;
            bytes += 2048 + (pane.key.length + record.datumKey.length) * 6 + label * 6;
        }
    if (!Number.isSafeInteger(bytes)) throw new ExportError('resource-limit', 'Export Scene estimate exceeds safe integer range');
    return bytes;
}

/** Fetches every requested page at export priority and releases it before moving to the next page. */
export async function exportRange(context: RangeExportContext, options: RangeExportOptions, signal?: AbortSignal): Promise<RangeExportManifest> {
    const limits = limitsFor(options.limits),
        task = exportTask(context.resources, limits, signal),
        version: ReadVersion = Object.freeze({ ...context.source.version });
    const viewport = { ...context.viewport },
        source = context.source,
        files: Readonly<ExportPageMetadata>[] = [];
    let reader: WindowReader | undefined;
    let reads = 0,
        totalBytes = 0,
        fontStamp: string | number | undefined,
        fontListener: (() => void) | undefined;
    const fontSet = typeof document === 'undefined' ? undefined : document.fonts;
    const assertSourceVersion = () => {
        if (!sameVersion(source.version, version)) throw new ExportError('version-expired', 'The source cannot continue the fixed export version');
    };
    const assertVersion = () => {
        task.check();
        assertSourceVersion();
        if (fontStamp !== undefined && context.fontRevision?.() !== fontStamp) throw new ExportError('version-expired', 'Font metrics changed during export');
    };
    // The manager's signal belongs to the shared provider call. Cancelling this export must
    // detach only this reader, not another display/export consumer of the same scheduled read.
    const call = async <T extends { version: ReadVersion }>(operation: () => Promise<T>, current: AbortSignal): Promise<T> => {
        assertSourceVersion();
        if (++reads > limits.maxReads) throw new ExportError('resource-limit', 'Export actual read-count limit exceeded');
        current.throwIfAborted();
        // The scheduler keeps a physical slot until the provider settles, even if it ignores cancellation.
        // Export consumers still detach promptly through the reader and outer task signal.
        const result = await operation();
        assertSourceVersion();
        if (!sameVersion(result.version, version)) throw new ExportError('version-expired', 'An export response belongs to a different version');
        return result;
    };
    const fixed: RenderDataSource = {
        version,
        describe: (current) => call(() => source.describe(current), current),
        readAxis: (request, current) => call(() => source.readAxis(request, current), current),
        readDomains: (request, current) => call(() => source.readDomains(request, current), current),
        readPaneData: (request, current) => call(() => source.readPaneData(request, current), current),
        locate: (request, current) => call(() => source.locate(request, current), current),
    };
    try {
        task.check();
        if (typeof options.sink !== 'function') throw new ExportError('source-contract-violation', 'Range export requires a per-page sink');
        task.reserve('plan', retainedBytes(context.plan) + retainedBytes(viewport) + retainedBytes(version));
        const plan = structuredClone(context.plan);
        reader = createWindowReader(fixed, plan, context.resources, { sourceIdentity: source, maxPages: Math.min(256, limits.maxReads) });
        const manifest = await withAbort(reader.describe({ signal: task.signal, priority: 'export', partition: 'export' }), task.signal);
        if (manifest.status !== 'complete') throw new ExportError('incomplete-export', 'Range export requires a complete fixed snapshot');
        const prepared = preflight(manifest, plan, viewport, options, limits);
        task.reserve('manifest', limits.maxPages * (4096 + retainedBytes(version) + retainedBytes(plan.domainPlanKey)));
        if (fontSet?.ready) await withAbort(fontSet.ready, task.signal);
        fontStamp = context.fontRevision?.();
        if (fontSet?.addEventListener) {
            fontListener = () => task.abort(new ExportError('version-expired', 'Fonts changed during export'));
            fontSet.addEventListener('loadingdone', fontListener);
        }
        const prefix = (options.filePrefix ?? 'worksheet').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'worksheet';
        for (const window of pagesFor(prepared.range, prepared.page)) {
            assertVersion();
            let input: WindowReadResult | undefined;
            try {
                const reading = reader.readWindow(window, { signal: task.signal, priority: 'export', partition: 'export' }).then((result) => {
                    if (task.signal.aborted) {
                        result.release();
                        throw abortReason(task.signal);
                    }
                    return result;
                });
                input = await withAbort(reading, task.signal);
                assertVersion();
                if (input.status !== 'complete' || !input.domainsReady || input.loadingWindows.length)
                    throw new ExportError('incomplete-export', 'An export page is not complete');
                task.reserve('scene', estimateScene(input));
                const size = pageDimensions(window, prepared.metrics);
                const frame = buildScene({
                    plan,
                    rows: input.rows,
                    columns: input.columns,
                    panes: input.panes,
                    domains: input.domains,
                    metrics: prepared.metrics,
                    ...size,
                    scrollX: window.columns.start * prepared.metrics.columnWidth,
                    scrollY: window.rows.start * prepared.metrics.rowHeight,
                    frameId: files.length + 1,
                });
                task.reserve('scene', retainedBytes(frame));
                task.reserve('output', limits.maxPageBytes * 5 + limits.maxPageElements * 128);
                const metadata: ExportPageMetadata = {
                    name: `${prefix}-r${window.rows.start}-${window.rows.end}-c${window.columns.start}-${window.columns.end}.svg`,
                    format: 'svg',
                    version: { ...version },
                    domainPlanKey: plan.domainPlanKey,
                    scope: 'range',
                    status: 'complete',
                    includesPlaceholders: false,
                    bytes: 0,
                    ...size,
                    range: copyWindow(window),
                    page: files.length,
                    fontFamily: plan.style?.fontFamily ?? 'sans-serif',
                    fontSize: plan.style?.fontSize ?? 11,
                };
                const svg = serializeSceneToSvg(frame, {
                    metadata: { ...metadata, bytes: undefined },
                    maxElements: limits.maxPageElements,
                    maxBytes: Math.min(limits.maxPageBytes, limits.maxTotalBytes - totalBytes),
                });
                assertVersion();
                metadata.bytes = svg.bytes;
                if (totalBytes + svg.bytes > limits.maxTotalBytes) throw new ExportError('resource-limit', 'Export actual total byte limit exceeded');
                const sinkMetadata = Object.freeze({
                    ...metadata,
                    version: Object.freeze({ ...metadata.version }),
                    range: metadata.range
                        ? Object.freeze({ rows: Object.freeze({ ...metadata.range.rows }), columns: Object.freeze({ ...metadata.range.columns }) })
                        : undefined,
                });
                const reply = await withAbort(options.sink({ content: svg.content, metadata: sinkMetadata }, task.signal), task.signal);
                assertVersion();
                if (reply?.name) {
                    if (typeof reply.name !== 'string' || reply.name.length > 1024)
                        throw new ExportError('resource-limit', 'Sink file names must contain at most 1024 characters');
                    metadata.name = reply.name;
                }
                files.push(Object.freeze(metadata));
                totalBytes += svg.bytes;
            } finally {
                input?.release();
                task.release('scene');
                task.release('output');
            }
        }
        assertVersion();
        return {
            format: 'svg',
            version: { ...version },
            domainPlanKey: plan.domainPlanKey,
            range: copyWindow(prepared.range),
            viewport,
            metrics: prepared.metrics,
            status: 'complete',
            files: Object.freeze(files),
            estimate: prepared.estimate,
            totals: { pages: files.length, reads, bytes: totalBytes, elapsedMs: performance.now() - task.started },
        };
    } finally {
        if (fontListener) fontSet?.removeEventListener('loadingdone', fontListener);
        reader?.dispose();
        task.dispose();
    }
}
export { preflight as preflightRangeExport };
