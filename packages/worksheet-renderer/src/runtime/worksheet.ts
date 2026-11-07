import type {
    RenderDataSource,
    RenderDataManifest,
    RenderPlan,
    ReadVersion,
    DomainBatch,
    AxisWindow,
    PaneBatch,
    AxisLocation,
    PaneWindow,
} from '../core/types';
import { buildScene, layoutMetrics, type SceneInput } from '../scene/build';
import { createSceneCache, sceneAccounting, type CachedPaneGeometry } from '../scene/cache';
import { type Box, type HeaderTarget, type HitRegion, type SceneFrame } from '../scene/types';
import { hitTest, hitsInBox, headerAt, hitIndexBytes } from '../scene/hit';
import { paintCanvas } from '../backends/canvas';
import { createSvgBackend } from '../backends/svg';
import { ScrollMapper } from './scroll';
import { assertRenderCapabilities } from '../core/capabilities';
import { assertCompleteWindow, assertLocation } from '../core/validateWindow';
import { domainRequestForWindow, sharedDomainRefs } from '../core/domains';
import { needsSeriesDomain } from '../core/series';
import { createRequestRegistry } from './requests';
import { createSemanticView, headerDescription } from './semantic';
import { withAbort } from './abort';
import { bindingValueLabel, typedValueLabel, pathKey } from '../core/keys';
import { clearTextMetrics, textMetricsBytes } from '../scene/text';
import { immutableSnapshot, type ReadonlySnapshot } from './snapshot';
import { createResourceManager, estimateBytes } from './resources';
import { createWindowReader, type WindowProgress } from './reader';
import { exportViewport as serializeViewport } from '../export/viewport';
import { exportRange as serializeRange } from '../export/range';
import type { ViewportExportOptions, ViewportExportSnapshot, RangeExportOptions } from '../export/types';
import { limitsFor } from '../export/shared';
import {
    selectionTarget,
    type WorksheetInput,
    type WorksheetOptions,
    type UpdateReceipt,
    type WorksheetEvents,
    type SelectionTarget,
    type FocusTarget,
    type HeaderRequestTarget,
    type LoadState,
} from './types';
export type { WorksheetInput, UpdateReceipt, WorksheetEvents } from './types';

type RuntimeSceneInput = SceneInput & { retainedDataBytes: number };

// A full-capacity grid needs an extra partial row/column during pixel scrolling.
const displayReaderLimits = { maxRecords: 40_400, maxPaneRecords: 20_000, maxWindowCells: 202 };

const sameVersion = (a: ReadVersion, b: ReadVersion) =>
    a.sourceId === b.sourceId && a.snapshotId === b.snapshotId && a.presentationId === b.presentationId;
/** One paint root, one scroll owner, and versioned display state. */
export function createWorksheet(host: HTMLElement, initial: WorksheetInput, options: WorksheetOptions = {}) {
    for (const value of [options.width, options.height, options.dpr, options.requestTimeoutMs])
        if (value !== undefined && (!Number.isFinite(value) || value <= 0))
            throw new Error('invalid-option: dimensions, DPR, and timeout must be positive finite numbers');
    if (
        options.resourceBudgetBytes !== undefined &&
        (!Number.isSafeInteger(options.resourceBudgetBytes) ||
            options.resourceBudgetBytes <= 0 ||
            options.resourceBudgetBytes > 128 * 1024 * 1024)
    )
        throw new Error('invalid-option: resourceBudgetBytes must be a positive integer at most 128 MiB');
    const resources = createResourceManager({
        maxBytes: options.resourceBudgetBytes,
    });
    const sceneCache = createSceneCache({
        get: (key) => resources.cacheGet<CachedPaneGeometry>('geometry', key),
        put: (key, value, bytes) => resources.cachePut('geometry', key, value, { bytes }),
        remove: (key) => resources.cacheRemove('geometry', key),
        measure: estimateBytes,
    });
    let reader = createWindowReader(initial.source, initial.plan, resources, displayReaderLimits);
    const lifetime = new AbortController();
    let prefetch = new AbortController();
    let fontRevision = 0;
    let input = initial,
        revision = 0,
        frameCounter = 0,
        disposed = false,
        loading = true,
        raf = 0;
    let pending = new AbortController(),
        manifest: RenderDataManifest | undefined,
        domains: DomainBatch | undefined;
    let frame: SceneFrame | undefined, paint: HTMLCanvasElement | SVGSVGElement, svgPaint: ReturnType<typeof createSvgBackend> | undefined;
    let frameVersion: ReadVersion | undefined,
        frameRevision = 0,
        layoutRevision = 0,
        loadState: LoadState = 'loading';
    let acceptedInput: WorksheetInput | undefined,
        lastScene: RuntimeSceneInput | undefined,
        focusId: string | undefined,
        headerFocus = false;
    let committed:
        | {
              input: WorksheetInput;
              frame: SceneFrame;
              scene: RuntimeSceneInput;
              manifest: RenderDataManifest;
              domains: DomainBatch;
              version: ReadVersion;
              inputRevision: number;
              scrollX: number;
              scrollY: number;
              scrollEpoch: number;
              reader: typeof reader;
          }
        | undefined;
    let requestedVersion = initial.source.version;
    let paintBackend: 'canvas' | 'svg' | undefined;
    let brush: Box | undefined,
        dragStart: { x: number; y: number; additive: boolean } | undefined,
        suppressClick = false;
    let manualWidth = options.width,
        manualHeight = options.height,
        requestedDpr = options.dpr;
    let scrollEpoch = 0;
    let readyEmitted = false;
    let requestNotice = '';
    const frameSnapshots = new WeakMap<SceneFrame, ReadonlySnapshot<SceneFrame>>();
    function frameSnapshot(value: SceneFrame | undefined) {
        if (!value) return undefined;
        let snapshot = frameSnapshots.get(value);
        if (!snapshot) {
            if (value === frame || value === committed?.frame)
                resources.reserve('public-frame-snapshot', estimateBytes(value, { sharedStrings: true }));
            snapshot = immutableSnapshot(value);
            frameSnapshots.set(value, snapshot);
        }
        return snapshot;
    }
    let scrollX = 0,
        scrollY = 0,
        expectedX = 0,
        expectedY = 0,
        width = 1,
        height = 1;
    let mx = new ScrollMapper(0, 1),
        my = new ScrollMapper(0, 1);
    const selected = new Set<string>(),
        selections = new Map<string, HitRegion>();
    const pendingTargets = new Map<string, SelectionTarget>();
    const frameWaiters = new Set<() => void>();
    const wakeFrameWaiters = () => {
        for (const check of [...frameWaiters]) check();
    };
    const listeners = new Map<keyof WorksheetEvents, Set<(value: any) => void>>();
    const root = document.createElement('div'),
        scroller = document.createElement('div'),
        spacer = document.createElement('div'),
        status = document.createElement('div');
    root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate';
    scroller.style.cssText =
        'position:absolute;inset:0;overflow:auto;z-index:1;background:transparent;outline:none;scrollbar-gutter:stable';
    scroller.tabIndex = 0;
    scroller.setAttribute('role', 'region');
    scroller.setAttribute('aria-label', 'Worksheet. Arrow keys scroll; Home and End jump to limits.');
    spacer.style.cssText = 'pointer-events:none;opacity:0';
    scroller.appendChild(spacer);
    status.style.cssText =
        'position:absolute;right:24px;top:6px;padding:3px 8px;background:#eef2ff;border-radius:4px;z-index:2;pointer-events:none;font:12px sans-serif';
    status.setAttribute('role', 'status');
    root.append(scroller, status);
    host.appendChild(root);
    const metadata = () => ({
        inputRevision: frame ? frameRevision : revision,
        version: frameVersion ?? input.source.version,
        frameId: frame?.frameId ?? 0,
    });
    const requests = createRequestRegistry(options.requestTimeoutMs ?? 10_000, (request, state, reason) => {
        const path = request.target.path.map((member) => bindingValueLabel(input.plan.bindings.find(binding => binding.fieldRef === member.fieldRef), member.value) ?? typedValueLabel(member.value)).join(' / ');
        requestNotice =
            state === 'pending'
                ? 'Waiting for host: ' + request.kind + ' ' + path
                : state === 'rejected' || state === 'expired'
                  ? request.kind + ' request ' + state + '. ' + (reason ?? '')
                  : '';
        if (!requestNotice && requests.snapshot().length)
            requestNotice = 'Waiting for host: ' + requests.snapshot().length + ' display requests';
        if (!loading) setStatus(requestNotice);
        syncSemantic();
        emit('requestStateChange', {
            ...metadata(),
            requestId: request.requestId,
            status: state,
            reason,
        });
    });
    const semantic = createSemanticView(root, options.accessibleName ?? 'Worksheet', {
        step: (delta) => moveFocus(delta),
        edge: (last) => moveFocus(last ? Infinity : -Infinity),
        toggleHeaders: () => {
            headerFocus = !headerFocus;
            focusId = undefined;
            moveFocus(0);
        },
        activate: () => activateFocus(),
        sort: () => {
            const target = focused();
            if (target?.kind === 'header') requestHeader(target, 'sort');
        },
        clear: () => choose([], 'clear', 'keyboard'),
        enter: () => {
            if (!focusId) moveFocus(0);
        },
        leave: () => scroller.focus?.(),
    });
    function emit<K extends keyof WorksheetEvents>(name: K, event: WorksheetEvents[K]) {
        const subscribers = listeners.get(name);
        if (!subscribers?.size) return;
        const handlers = [...subscribers],
            snapshot = immutableSnapshot(event);
        // Host callbacks run after the current state transaction, never halfway through a commit.
        queueMicrotask(() => {
            if (disposed) return;
            for (const listener of handlers) if (listeners.get(name)?.has(listener)) listener(snapshot);
        });
    }
    function setStatus(message: string) {
        status.textContent = message;
        status.hidden = !message;
        root.setAttribute('aria-busy', String(loading));
    }
    function setLoadState(state: LoadState, message = '') {
        loadState = state;
        loading = state === 'loading' || state === 'stale';
        setStatus(message || requestNotice);
        semantic.tooltip(undefined);
        if (loading || state === 'error') semantic.update(undefined, undefined, false, message || state);
        emit('loadStateChange', {
            ...metadata(),
            state,
            requestedVersion,
            message,
        });
        wakeFrameWaiters();
    }
    function diagnostic(error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const structured =
            error && typeof error === 'object'
                ? (error as {
                      diagnostic?: Partial<import('../core/types').Diagnostic>;
                      code?: string;
                      fieldRef?: string;
                  })
                : undefined;
        const details = structured?.diagnostic;
        const prefix = /^[a-z][a-z0-9-]+:/.test(message) ? message.split(':')[0] : 'render-error';
        emit('diagnostic', {
            ...metadata(),
            code: details?.code ?? structured?.code ?? prefix,
            message: details?.message ?? message,
            severity: details?.severity ?? 'error',
            recoverable: details?.recoverable ?? true,
            fieldRef: details?.fieldRef ?? structured?.fieldRef,
            configRef: details?.configRef,
        });
        return message;
    }
    function createPaint(backend = input.backend ?? 'canvas') {
        paint?.remove();
        paintBackend = backend;
        if (backend === 'svg') {
            paint = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgPaint = createSvgBackend(paint);
        } else {
            paint = document.createElement('canvas');
            svgPaint = undefined;
        }
        paint.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:0';
        paint.setAttribute('aria-hidden', 'true');
        root.prepend(paint);
    }
    function draw(next: SceneFrame, backend = input.backend ?? 'canvas') {
        if (!paint || paintBackend !== backend) createPaint(backend);
        if (paint instanceof HTMLCanvasElement) paintCanvas(paint, next, requestedDpr);
        else svgPaint!(next);
    }
    function buildAndDraw(scene: RuntimeSceneInput, backend = input.backend ?? 'canvas', beforeDraw?: (next: SceneFrame) => void) {
        // The reader measures its immutable payload once; scrolling only creates small display state.
        const dataBytes = scene.retainedDataBytes + 1024;
        resources.reserve('candidate-frame', dataBytes);
        try {
            const sceneStarted = performance.now();
            const retainedPanes: Array<{ value: CachedPaneGeometry; bytes: number }> = [];
            const next = buildScene({
                ...scene,
                onRetainPane(value, bytes, translatedBytes) {
                    retainedPanes.push({ value, bytes });
                    resources.reserve('candidate-frame', dataBytes + translatedBytes + sceneCache.metadataBytes() + textMetricsBytes(), {
                        shared: retainedPanes,
                    });
                },
            });
            const sceneMs = performance.now() - sceneStarted;
            if (next.hits.length > 20_000) throw new Error('resource-limit: viewport exceeds 20,000 marks');
            // The readonly public copy is charged only when requested. Its immutable strings are shared.
            // Cached pane costs include their retained base geometry even if the LRU evicts it.
            const accounting = sceneAccounting(next);
            const geometryBytes = accounting?.exclusiveBytes ?? estimateBytes(next) + hitIndexBytes(next);
            const cost = dataBytes + geometryBytes + textMetricsBytes();
            const reservation = { shared: accounting?.bases };
            resources.reserve('candidate-frame', cost, reservation);
            beforeDraw?.(next);
            const submitted = performance.now();
            draw(next, backend);
            const submitMs = performance.now() - submitted;
            resources.release('display-frame');
            resources.release('public-frame-snapshot');
            resources.release('candidate-frame');
            resources.reserve('display-frame', cost, reservation);
            return { next, sceneMs, submitMs };
        } catch (error) {
            resources.release('candidate-frame');
            throw error;
        }
    }
    function retainCommittedDisplay() {
        frame = undefined;
        frameVersion = undefined;
        lastScene = undefined;
        manifest = undefined;
        domains = undefined;
        if (committed) {
            if (reader !== committed.reader) reader.dispose();
            reader = committed.reader;
            input = committed.input;
            acceptedInput = committed.input;
            manifest = committed.manifest;
            domains = committed.domains;
            draw(committed.frame, committed.input.backend ?? 'canvas');
        } else createPaint();
    }
    function physicalSync() {
        scroller.scrollLeft = mx.toPhysical(scrollX);
        scroller.scrollTop = my.toPhysical(scrollY);
        expectedX = scroller.scrollLeft;
        expectedY = scroller.scrollTop;
    }
    function dimensions() {
        width = Math.max(1, options.autoResize === false ? (manualWidth ?? scroller.clientWidth) : scroller.clientWidth);
        height = Math.max(1, options.autoResize === false ? (manualHeight ?? scroller.clientHeight) : scroller.clientHeight);
        const m = layoutMetrics(input.plan, width, height),
            bodyWidth = Math.max(1, width - m.headerWidth - m.legendWidth),
            bodyHeight = Math.max(1, height - m.headerHeight);
        mx = new ScrollMapper((manifest?.columnLeafCount ?? 0) * m.columnWidth, bodyWidth);
        my = new ScrollMapper((manifest?.rowLeafCount ?? 0) * m.rowHeight, bodyHeight);
        spacer.style.width = `${width + mx.physicalMax}px`;
        spacer.style.height = `${height + my.physicalMax}px`;
        scrollX = mx.clamp(scrollX);
        scrollY = my.clamp(scrollY);
        physicalSync();
    }
    function focused(): HitRegion | HeaderTarget | undefined {
        return frame?.headers.find((target) => target.id === focusId) ?? frame?.hits.find((target) => target.id === focusId);
    }
    function syncSemantic() {
        const target = focused();
        semantic.update(
            frame,
            target,
            !!target && selected.has(target.id),
            (options.accessibleName ?? 'Worksheet') +
                '. ' +
                (manifest ? manifest.rowLeafCount + ' row positions, ' + manifest.columnLeafCount + ' column positions. ' : '') +
                (frame
                    ? 'Visible rows start at ' +
                      (frame.rowStart + 1) +
                      ', columns at ' +
                      (frame.columnStart + 1) +
                      '. ' +
                      frame.hits.length +
                      ' visible chart items. '
                    : '') +
                loadState +
                '. ' +
                requestNotice,
        );
    }
    function redrawOverlay() {
        if (!frame || !lastScene || loading || disposed) return;
        const { next } = buildAndDraw({
            ...lastScene,
            frameId: ++frameCounter,
            selected,
            focusId,
            brush,
        });
        frame = next;
        if (committed) committed = { ...committed, frame: next };
        syncSemantic();
    }
    function currentSelection(): readonly SelectionTarget[] {
        return [...selected]
            .map((id) => (selections.has(id) ? selectionTarget(selections.get(id)!, input.plan) : pendingTargets.get(id)))
            .filter((target): target is SelectionTarget => !!target);
    }
    function selectionBytes(ids: ReadonlySet<string>, hits: ReadonlyMap<string, HitRegion>, targets: ReadonlyMap<string, SelectionTarget>) {
        if (ids.size > 20_000) throw new Error('resource-limit: selection exceeds 20,000 targets');
        return estimateBytes({ ids, hits, targets }) * 2;
    }
    function applySelection(ids: ReadonlySet<string>, hits: ReadonlyMap<string, HitRegion>, targets: ReadonlyMap<string, SelectionTarget>) {
        resources.reserve('selection', selectionBytes(ids, hits, targets));
        selected.clear();
        selections.clear();
        pendingTargets.clear();
        for (const id of ids) selected.add(id);
        for (const [id, hit] of hits) selections.set(id, hit);
        for (const [id, target] of targets) pendingTargets.set(id, target);
    }
    function changeSelection(
        ids: ReadonlySet<string>,
        hits: ReadonlyMap<string, HitRegion>,
        targets: ReadonlyMap<string, SelectionTarget>,
    ) {
        const previousIds = new Set(selected),
            previousKnown = new Map(selections),
            previousPending = new Map(pendingTargets);
        applySelection(ids, hits, targets);
        try {
            redrawOverlay();
        } catch (error) {
            applySelection(previousIds, previousKnown, previousPending);
            throw error;
        }
    }
    function choose(hits: readonly HitRegion[], operation: 'replace' | 'add' | 'toggle' | 'clear', source: 'pointer' | 'keyboard') {
        if (loading || !frame || disposed) return;
        const clear = operation === 'replace' || operation === 'clear';
        const ids = clear ? new Set<string>() : new Set(selected),
            known = clear ? new Map<string, HitRegion>() : new Map(selections),
            unknown = clear ? new Map<string, SelectionTarget>() : new Map(pendingTargets);
        for (const hit of hits) {
            if (operation === 'toggle' && ids.has(hit.id)) {
                ids.delete(hit.id);
                known.delete(hit.id);
                unknown.delete(hit.id);
            } else {
                ids.add(hit.id);
                known.set(hit.id, hit);
                unknown.delete(hit.id);
            }
        }
        try {
            changeSelection(ids, known, unknown);
        } catch (error) {
            setStatus(diagnostic(error));
            return;
        }
        emit('selectionChange', {
            ...metadata(),
            targets: currentSelection(),
            operation,
            source,
        });
    }
    function setSelection(targets: readonly SelectionTarget[]) {
        if (disposed) return;
        const ids = new Set<string>(),
            known = new Map<string, HitRegion>(),
            unknown = new Map<string, SelectionTarget>();
        for (const target of targets) {
            ids.add(target.markId);
            const hit = frame?.hits.find((item) => item.id === target.markId);
            if (hit) known.set(hit.id, hit);
            else
                unknown.set(target.markId, {
                    ...target,
                    datumKeys: [...target.datumKeys],
                    values: [...target.values],
                });
        }
        changeSelection(ids, known, unknown);
    }
    function moveFocus(delta: number) {
        if (!frame || loading) return;
        const items = headerFocus ? frame.headers : frame.hits;
        if (!items.length) {
            focusId = undefined;
            syncSemantic();
            return;
        }
        const at = items.findIndex((item) => item.id === focusId);
        const next =
            delta === Infinity
                ? items.length - 1
                : delta === -Infinity
                  ? 0
                  : Math.max(0, Math.min(items.length - 1, (at < 0 ? 0 : at) + delta));
        focusId = items[next].id;
        redrawOverlay();
        emit('viewStateChange', {
            ...metadata(),
            scrollX,
            scrollY,
            focus: focusTarget(),
            source: 'keyboard',
        });
    }
    function focusTarget(): FocusTarget | undefined {
        const target = focused();
        if (!target) return undefined;
        return target.kind === 'header'
            ? { headerKey: target.key }
            : {
                  markId: target.id,
                  rowKey: target.rowKey,
                  columnKey: target.columnKey,
              };
    }
    function requestHeader(target: HeaderTarget, kind: 'collapse' | 'sort') {
        if (!target.fieldRef || loading) return;
        if (kind === 'collapse' && !target.canCollapse) return;
        const header = {
            axis: target.axis,
            key: target.key,
            path: target.path,
            fieldRef: target.fieldRef,
        };
        if (kind === 'collapse') requestCollapse(header, target.expanded === false);
        else requestSort(header, 'ascending');
    }
    function requestCollapse(target: HeaderRequestTarget, expanded: boolean) {
        if (disposed || loading || !frame) return undefined;
        const context = metadata();
        const request = requests.create(input.source.version.presentationId, target, 'collapse', { expanded });
        emit('collapseRequest', { ...context, ...request });
        return request.requestId;
    }
    function requestSort(target: HeaderRequestTarget, direction: 'ascending' | 'descending') {
        if (disposed || loading || !frame) return undefined;
        const context = metadata();
        const request = requests.create(input.source.version.presentationId, target, 'sort', { direction });
        emit('sortRequest', { ...context, ...request });
        return request.requestId;
    }
    function activateFocus() {
        const target = focused();
        if (!target) return;
        if (target.kind === 'header') requestHeader(target, 'collapse');
        else choose([target], 'toggle', 'keyboard');
    }
    function prefetchWindow(window: PaneWindow, activeReader: typeof reader, description: RenderDataManifest) {
        if (options.overscan === false || description.status !== 'complete' || disposed) return;
        prefetch.abort();
        prefetch = new AbortController();
        const rowCount = window.rows.end - window.rows.start,
            columnCount = window.columns.end - window.columns.start;
        let rowPad = rowCount,
            columnPad = columnCount;
        const expanded = () => ({
            rows: {
                start: Math.max(0, window.rows.start - rowPad),
                end: Math.min(description.rowLeafCount, window.rows.end + rowPad),
            },
            columns: {
                start: Math.max(0, window.columns.start - columnPad),
                end: Math.min(description.columnLeafCount, window.columns.end + columnPad),
            },
        });
        let target = expanded();
        while ((target.rows.end - target.rows.start) * (target.columns.end - target.columns.start) > 100 && (rowPad || columnPad)) {
            if (rowPad >= columnPad && rowPad) rowPad--;
            else columnPad--;
            target = expanded();
        }
        if (JSON.stringify(target) === JSON.stringify(window)) return;
        void activeReader.readWindow(target, { signal: prefetch.signal, priority: 'overscan' }).then(
            (result) => result.release(),
            () => {
                /* Optional overscan can be dropped; required viewport failures remain visible. */
            },
        );
    }
    async function render(expected?: { row?: AxisLocation; column?: AxisLocation; scrollEpoch: number }): Promise<UpdateReceipt> {
        const own = revision,
            started = performance.now(),
            layoutAtStart = layoutRevision;
        if (disposed) return { inputRevision: own, status: 'disposed' };
        if (!manifest || !domains || (loadState === 'error' && committed?.inputRevision !== own))
            return { inputRevision: own, status: 'rejected' };
        prefetch.abort();
        pending.abort();
        pending = new AbortController();
        const signal = pending.signal,
            activeReader = reader,
            batchManifest = manifest,
            plan = input.plan,
            version = input.source.version;
        const x = scrollX,
            y = scrollY,
            m = layoutMetrics(plan, width, height),
            frameWidth = width,
            frameHeight = height;
        const rowStart = Math.floor(y / m.rowHeight),
            colStart = Math.floor(x / m.columnWidth);
        const rows = {
            start: rowStart,
            end: Math.min(
                manifest.rowLeafCount,
                height > m.headerHeight ? Math.ceil((y + height - m.headerHeight) / m.rowHeight) : rowStart,
            ),
        };
        const columns = {
            start: colStart,
            end: Math.min(
                manifest.columnLeafCount,
                width > m.headerWidth + m.legendWidth ? Math.ceil((x + width - m.headerWidth - m.legendWidth) / m.columnWidth) : colStart,
            ),
        };
        const window = { rows, columns };
        const current = () =>
            !disposed &&
            !signal.aborted &&
            own === revision &&
            x === scrollX &&
            y === scrollY &&
            frameWidth === width &&
            frameHeight === height &&
            layoutAtStart === layoutRevision;
        setLoadState(frame ? 'stale' : 'loading', 'Loading worksheet…');
        const setupCpuMs = performance.now() - started;
        return new Promise<UpdateReceipt>((resolve) => {
            let resolved = false;
            const finish = (receipt: UpdateReceipt) => {
                if (!resolved) {
                    resolved = true;
                    resolve(receipt);
                }
            };
            const superseded = (): UpdateReceipt => ({
                inputRevision: own,
                status: disposed ? 'disposed' : 'superseded',
            });
            const present = (batch: WindowProgress): UpdateReceipt => {
                const readMs = performance.now() - started,
                    cpuStarted = performance.now();
                if (expected?.scrollEpoch === scrollEpoch) {
                    for (const [location, axisData] of [
                        [expected.row, batch.rows],
                        [expected.column, batch.columns],
                    ] as const) {
                        if (!location || location.status === 'missing') continue;
                        const rank = location.status === 'found' ? location.rank : location.ancestor.start;
                        const actual = axisData.leaves.find((leaf) => leaf.rank === rank);
                        if (
                            !actual ||
                            (location.status === 'found'
                                ? actual.key !== location.leaf.key
                                : !actual.collapsed || pathKey(actual.path) !== pathKey(location.ancestor.path))
                        )
                            throw new Error('source-contract-violation: located member does not match the rendered axis window');
                    }
                }
                const sourceChanged = !!committed && committed.input.source.version.sourceId !== version.sourceId;
                const snapshotChanged = !!committed && committed.input.source.version.snapshotId !== version.snapshotId;
                const newInputCommit = committed?.inputRevision !== own;
                const previousPresentation = committed?.version.presentationId ?? version.presentationId;
                if (newInputCommit) requests.validate(input.requestResults, previousPresentation);
                const controlledTargets = newInputCommit ? input.viewState?.selection : undefined;
                const frameSelection = controlledTargets
                    ? new Set(controlledTargets.map((target) => target.markId))
                    : sourceChanged
                      ? new Set<string>()
                      : selected;
                const frameFocus =
                    newInputCommit && input.viewState?.focus ? input.viewState.focus.markId : sourceChanged ? undefined : focusId;
                lastScene = {
                    plan,
                    rows: batch.rows,
                    columns: batch.columns,
                    panes: batch.panes,
                    domains: batch.domains,
                    dataStatus: batch.status,
                    domainsReady: batch.domainsReady,
                    retainedDataBytes: batch.retainedBytes,
                    cache: sceneCache,
                    width: frameWidth,
                    height: frameHeight,
                    scrollX: x,
                    scrollY: y,
                    frameId: ++frameCounter,
                    selected: frameSelection,
                    focusId: frameFocus,
                    brush,
                };
                if (controlledTargets && controlledTargets.length > 20_000)
                    throw new Error('resource-limit: selection exceeds 20,000 targets');
                const nextIds = new Set(frameSelection),
                    nextKnown = sourceChanged || snapshotChanged || controlledTargets ? new Map<string, HitRegion>() : new Map(selections),
                    nextPending = sourceChanged || controlledTargets ? new Map<string, SelectionTarget>() : new Map(pendingTargets);
                if (snapshotChanged && !sourceChanged && !controlledTargets) {
                    for (const [id, target] of nextPending) nextPending.set(id, { ...target, values: [] });
                    for (const [id, hit] of selections)
                        nextPending.set(id, {
                            ...selectionTarget(hit, committed!.input.plan),
                            values: [],
                        });
                }
                if (controlledTargets)
                    for (const target of controlledTargets)
                        nextPending.set(target.markId, {
                            ...target,
                            datumKeys: [...target.datumKeys],
                            values: [...target.values],
                        });
                let selectionCost = 0;
                let drawn: ReturnType<typeof buildAndDraw>;
                try {
                    drawn = buildAndDraw(lastScene, input.backend ?? 'canvas', (candidate) => {
                        for (const hit of candidate.hits)
                            if (nextIds.has(hit.id)) {
                                nextKnown.set(hit.id, hit);
                                nextPending.delete(hit.id);
                            }
                        selectionCost = selectionBytes(nextIds, nextKnown, nextPending);
                        resources.reserve('candidate-selection', selectionCost);
                    });
                } catch (error) {
                    resources.release('candidate-selection');
                    throw error;
                }
                const { next, sceneMs, submitMs } = drawn;
                resources.release('candidate-selection');
                applySelection(nextIds, nextKnown, nextPending);
                focusId = frameFocus;
                frame = next;
                frameVersion = version;
                frameRevision = own;
                acceptedInput = input;
                if (committed && committed.reader !== activeReader) committed.reader.dispose();
                committed = {
                    input,
                    frame: next,
                    scene: lastScene,
                    manifest: batch.manifest,
                    domains: batch.domains,
                    reader: activeReader,
                    version,
                    inputRevision: own,
                    scrollX: x,
                    scrollY: y,
                    scrollEpoch,
                };
                if (newInputCommit) {
                    requests.commit(input.requestResults, previousPresentation, version.presentationId);
                    if (sourceChanged) requests.supersedeAll('A different data source was committed');
                    if (!requests.snapshot().length) requestNotice = '';
                }
                setLoadState(
                    batch.status,
                    batch.status === 'preview' ? 'Preview: incomplete input' : batch.status === 'loading' ? 'Loading remaining panes…' : '',
                );
                syncSemantic();
                if (sourceChanged && !controlledTargets)
                    emit('selectionChange', {
                        ...metadata(),
                        targets: [],
                        operation: 'clear',
                        source: 'input',
                    });
                if (!readyEmitted) {
                    readyEmitted = true;
                    emit('ready', {
                        ...metadata(),
                        backend: input.backend ?? 'canvas',
                        loadState,
                    });
                }
                emit('viewStateChange', {
                    ...metadata(),
                    scrollX,
                    scrollY,
                    focus: focusTarget(),
                    source: 'render',
                });
                if (options.metrics)
                    emit('metrics', {
                        ...metadata(),
                        renderMs: performance.now() - started,
                        marks: frame.hits.length,
                        commands: frame.commands.length,
                        readMs,
                        sceneMs,
                        submitMs,
                        cpuMs: setupCpuMs + performance.now() - cpuStarted + batch.timings.readerCpuMs + batch.timings.sourceSyncMs,
                        cacheWindows: resources.stats().layers.data.entries,
                        resources: resources.stats(),
                    });
                return {
                    inputRevision: own,
                    status: 'committed',
                    frameId: next.frameId,
                };
            };
            void (async () => {
                try {
                    const nominalRows = Math.min(
                        batchManifest.rowLeafCount,
                        Math.ceil(Math.max(0, frameHeight - m.headerHeight) / m.rowHeight),
                    );
                    const nominalColumns = Math.min(
                        batchManifest.columnLeafCount,
                        Math.ceil(Math.max(0, frameWidth - m.headerWidth - m.legendWidth) / m.columnWidth),
                    );
                    if (nominalRows * nominalColumns > 100)
                        throw new Error('resource-limit: viewport exceeds the 100-pane grid capacity; increase fixed strip sizes');
                    const batch = await activeReader.readWindow(window, {
                        signal,
                        priority: 'viewport',
                        onProgress: (progress) => {
                            if (current()) finish(present(progress));
                        },
                    });
                    try {
                        if (!current()) finish(superseded());
                        else {
                            finish(present(batch));
                            if (batch.status === 'complete') prefetchWindow(window, activeReader, batch.manifest);
                        }
                    } finally {
                        batch.release();
                    }
                } catch (error) {
                    if (!current()) {
                        finish(superseded());
                        return;
                    }
                    pending.abort();
                    const message = diagnostic(error);
                    retainCommittedDisplay();
                    setLoadState('error', message);
                    syncSemantic();
                    finish({ inputRevision: own, status: 'rejected' });
                }
            })();
        });
    }
    function schedule() {
        if (!raf && !disposed)
            raf = requestAnimationFrame(() => {
                raf = 0;
                void render();
            });
    }
    function move(x: number, y: number) {
        scrollEpoch++;
        scrollX = mx.clamp(x);
        scrollY = my.clamp(y);
        physicalSync();
        wakeFrameWaiters();
        schedule();
    }
    const onScroll = () => {
        let changed = false;
        if (Math.abs(scroller.scrollLeft - expectedX) > 0.5) {
            scrollX = mx.toLogical(scroller.scrollLeft);
            changed = true;
        }
        if (Math.abs(scroller.scrollTop - expectedY) > 0.5) {
            scrollY = my.toLogical(scroller.scrollTop);
            changed = true;
        }
        if (changed) scrollEpoch++;
        expectedX = scroller.scrollLeft;
        expectedY = scroller.scrollTop;
        if (changed) schedule();
    };
    const onWheel = (e: WheelEvent) => {
        if (dragStart) {
            e.preventDefault();
            return;
        }
        if (!mx.compressed && !my.compressed) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1;
        move(scrollX + (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit, scrollY + (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit);
    };
    const onKey = (e: KeyboardEvent) => {
        const actions: Record<string, () => void> = {
            ArrowDown: () => move(scrollX, scrollY + 40),
            ArrowUp: () => move(scrollX, scrollY - 40),
            ArrowLeft: () => move(scrollX - 40, scrollY),
            ArrowRight: () => move(scrollX + 40, scrollY),
            PageDown: () => move(scrollX, scrollY + height * 0.8),
            PageUp: () => move(scrollX, scrollY - height * 0.8),
            Home: () => move(0, 0),
            End: () => move(mx.logicalMax, my.logicalMax),
        };
        if (actions[e.key]) {
            e.preventDefault();
            actions[e.key]();
        }
    };
    const onClick = (e: MouseEvent) => {
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        if (loading || !frame) return;
        const bounds = scroller.getBoundingClientRect(),
            x = e.clientX - bounds.left,
            y = e.clientY - bounds.top;
        const header = headerAt(frame, x, y);
        if (header) {
            focusId = header.id;
            headerFocus = true;
            requestHeader(header, e.shiftKey ? 'sort' : 'collapse');
            redrawOverlay();
            return;
        }
        const hit = hitTest(frame, x, y);
        if (hit) {
            focusId = hit.id;
            headerFocus = false;
        }
        choose(hit ? [hit] : [], hit ? (e.ctrlKey || e.metaKey || e.shiftKey ? 'toggle' : 'replace') : 'clear', 'pointer');
    };
    const point = (event: MouseEvent) => {
        const rect = scroller.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onPointerDown = (event: PointerEvent) => {
        if (!event.shiftKey || event.button !== 0 || loading || !frame) return;
        const at = point(event),
            metrics = layoutMetrics(input.plan, width, height);
        if (at.x < metrics.headerWidth || at.y < metrics.headerHeight) return;
        dragStart = { ...at, additive: event.ctrlKey || event.metaKey };
        brush = { ...at, width: 0, height: 0 };
        scroller.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        semantic.tooltip(undefined);
    };
    const onPointerMove = (event: PointerEvent) => {
        if (loading || !frame) return;
        const at = point(event);
        if (dragStart) {
            brush = {
                x: Math.min(dragStart.x, at.x),
                y: Math.min(dragStart.y, at.y),
                width: Math.abs(at.x - dragStart.x),
                height: Math.abs(at.y - dragStart.y),
            };
            redrawOverlay();
            return;
        }
        const target = headerAt(frame, at.x, at.y) ?? hitTest(frame, at.x, at.y);
        semantic.tooltip(
            (target?.kind === 'header' ? headerDescription(target) : target?.label) ??
                (target && 'values' in target
                    ? Object.entries(target.values)
                          .map(([key, value]) => key + ': ' + String(value ?? '(null)'))
                          .join('\n')
                    : undefined),
            at.x,
            at.y,
        );
    };
    const onPointerUp = (event: PointerEvent) => {
        if (!dragStart) return;
        const area = brush,
            additive = dragStart.additive;
        dragStart = undefined;
        brush = undefined;
        scroller.releasePointerCapture?.(event.pointerId);
        if (frame && area && (area.width > 3 || area.height > 3)) {
            suppressClick = true;
            choose(hitsInBox(frame, area), additive ? 'add' : 'replace', 'pointer');
        } else redrawOverlay();
    };
    const onPointerCancel = () => {
        dragStart = undefined;
        brush = undefined;
        redrawOverlay();
    };
    const onPointerLeave = () => {
        if (!dragStart) semantic.tooltip(undefined);
    };
    scroller.addEventListener('scroll', onScroll);
    scroller.addEventListener('wheel', onWheel, { passive: false });
    scroller.addEventListener('keydown', onKey);
    scroller.addEventListener('click', onClick);
    scroller.addEventListener('pointerdown', onPointerDown);
    scroller.addEventListener('pointermove', onPointerMove);
    scroller.addEventListener('pointerup', onPointerUp);
    scroller.addEventListener('pointercancel', onPointerCancel);
    scroller.addEventListener('pointerleave', onPointerLeave);
    const onResize = (force = false) => {
        const previousWidth = width,
            previousHeight = height;
        dimensions();
        if (force || width !== previousWidth || height !== previousHeight) {
            layoutRevision++;
            wakeFrameWaiters();
            schedule();
        }
    };
    const resize = options.autoResize === false ? undefined : new ResizeObserver(() => onResize());
    resize?.observe(root);
    let dprMedia: MediaQueryList | undefined;
    const onDpr = () => {
        dprMedia?.removeEventListener?.('change', onDpr);
        if (requestedDpr === undefined && typeof window.matchMedia === 'function') {
            dprMedia = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
            dprMedia.addEventListener?.('change', onDpr, { once: true });
        }
        onResize(true);
    };
    if (typeof window.matchMedia === 'function') {
        dprMedia = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
        dprMedia.addEventListener?.('change', onDpr, { once: true });
    }
    const onFonts = () => {
        clearTextMetrics();
        sceneCache.clear();
        fontRevision++;
        layoutRevision++;
        wakeFrameWaiters();
        if (frame && !loading) redrawOverlay();
        else schedule();
    };
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    async function readSharedDomains(candidate: WorksheetInput, signal: AbortSignal): Promise<DomainBatch> {
        const fieldRefs = sharedDomainRefs(candidate.plan);
        if (!fieldRefs.length && !needsSeriesDomain(candidate.plan)) return { version: candidate.source.version, domains: {} };
        return reader.readDomains({ version: candidate.source.version, fieldRefs }, { signal, priority: 'metadata' });
    }
    async function update(next: WorksheetInput): Promise<UpdateReceipt> {
        const own = ++revision;
        if (disposed) return { inputRevision: own, status: 'disposed' };
        pending.abort();
        prefetch.abort();
        pending = new AbortController();
        const signal = pending.signal;
        const previous = committed?.input ?? acceptedInput ?? input;
        const previousPresentation = previous.source.version.presentationId;
        const beforeScroll = scrollEpoch;
        const previousTarget = { x: scrollX, y: scrollY };
        let expectedLocations: { row?: AxisLocation; column?: AxisLocation; scrollEpoch: number } | undefined;
        const oldMetrics = layoutMetrics(previous.plan, committed?.frame.width ?? width, committed?.frame.height ?? height);
        const anchor = committed
            ? {
                  rowKey: committed.scene.rows.leaves[0]?.key,
                  columnKey: committed.scene.columns.leaves[0]?.key,
                  dy: committed.scrollY % oldMetrics.rowHeight,
                  dx: committed.scrollX % oldMetrics.columnWidth,
                  scrollEpoch: committed.scrollEpoch,
              }
            : undefined;
        const dataPlan = (plan: RenderPlan) => {
            const { style: _style, axes: _axes, layout: _layout, ...rest } = plan;
            return JSON.stringify(rest);
        };
        const reuse = next.source === input.source && dataPlan(next.plan) === dataPlan(input.plan) && manifest && domains;
        frame = undefined;
        frameVersion = undefined;
        lastScene = undefined;
        brush = undefined;
        dragStart = undefined;
        requestedVersion = next.source.version;
        setLoadState('loading', 'Loading worksheet…');
        semantic.tooltip(undefined);
        try {
            assertRenderCapabilities(next.plan);
            if (next.version && !sameVersion(next.version, next.source.version))
                throw new Error('source-contract-violation: input version must match the source');
            requests.validate(next.requestResults, previousPresentation);
            if (input.source !== next.source) sceneCache.clear();
            input = next;
            if (!paint) createPaint();
            if (!reuse) {
                manifest = undefined;
                domains = undefined;
                if (reader !== committed?.reader) reader.dispose();
                reader = createWindowReader(next.source, next.plan, resources, displayReaderLimits);
                const [description, domainData] = await withAbort(
                    Promise.all([reader.describe({ signal, priority: 'metadata' }), readSharedDomains(next, signal)]),
                    signal,
                );
                if (disposed || signal.aborted || own !== revision)
                    return {
                        inputRevision: own,
                        status: disposed ? 'disposed' : 'superseded',
                    };
                if (
                    !sameVersion(description.version, next.source.version) ||
                    !sameVersion(domainData.version, next.source.version) ||
                    description.domainPlanKey !== next.plan.domainPlanKey
                )
                    throw new Error('source-contract-violation: manifest or domain mismatch');
                manifest = description;
                domains = domainData;
            }
            if (scrollEpoch === beforeScroll) {
                if (next.source.version.sourceId !== previous.source.version.sourceId) {
                    scrollX = 0;
                    scrollY = 0;
                }
                if (next.viewState?.scroll) {
                    scrollX = next.viewState.scroll.x ?? scrollX;
                    scrollY = next.viewState.scroll.y ?? scrollY;
                }
            }
            dimensions();
            if (
                anchor &&
                !next.viewState?.scroll &&
                previous.source.version.sourceId === next.source.version.sourceId &&
                (previousPresentation !== next.source.version.presentationId ||
                    JSON.stringify(previous.plan.layout) !== JSON.stringify(next.plan.layout)) &&
                beforeScroll === scrollEpoch &&
                beforeScroll === anchor.scrollEpoch
            ) {
                const [row, column] = await withAbort(
                    Promise.all([
                        anchor.rowKey
                            ? reader.locate(
                                  {
                                      version: next.source.version,
                                      axis: 'row',
                                      key: anchor.rowKey,
                                  },
                                  { signal },
                              )
                            : undefined,
                        anchor.columnKey
                            ? reader.locate(
                                  {
                                      version: next.source.version,
                                      axis: 'column',
                                      key: anchor.columnKey,
                                  },
                                  { signal },
                              )
                            : undefined,
                    ]),
                    signal,
                );
                if (disposed || signal.aborted || own !== revision)
                    return {
                        inputRevision: own,
                        status: disposed ? 'disposed' : 'superseded',
                    };
                if (row && anchor.rowKey)
                    assertLocation({
                        location: row,
                        request: {
                            version: next.source.version,
                            axis: 'row',
                            key: anchor.rowKey,
                        },
                        plan: next.plan,
                        manifest: manifest!,
                    });
                if (column && anchor.columnKey)
                    assertLocation({
                        location: column,
                        request: {
                            version: next.source.version,
                            axis: 'column',
                            key: anchor.columnKey,
                        },
                        plan: next.plan,
                        manifest: manifest!,
                    });
                if (beforeScroll === scrollEpoch) {
                    const metrics = layoutMetrics(next.plan, width, height);
                    const rank = (location: typeof row) =>
                        location?.status === 'found' ? location.rank : location?.status === 'hidden' ? location.ancestor.start : undefined;
                    if (rank(row) !== undefined)
                        scrollY = my.clamp(rank(row)! * metrics.rowHeight + (row?.status === 'hidden' ? 0 : anchor.dy));
                    if (rank(column) !== undefined)
                        scrollX = mx.clamp(rank(column)! * metrics.columnWidth + (column?.status === 'hidden' ? 0 : anchor.dx));
                    physicalSync();
                    expectedLocations = { row, column, scrollEpoch };
                }
            }
            let receipt = await render(expectedLocations);
            while (receipt.status === 'superseded' && own === revision && !disposed) {
                if (raf) {
                    cancelAnimationFrame(raf);
                    raf = 0;
                }
                receipt = await render(expectedLocations);
            }
            if (receipt.status === 'committed' && own === revision) {
                acceptedInput = next;
                if (next.viewState?.focus) await focus(next.viewState.focus);
            } else if (receipt.status === 'rejected' && own === revision && scrollEpoch === beforeScroll) {
                scrollX = previousTarget.x;
                scrollY = previousTarget.y;
                dimensions();
            }
            return receipt;
        } catch (error) {
            if (disposed || signal.aborted || own !== revision)
                return {
                    inputRevision: own,
                    status: disposed ? 'disposed' : 'superseded',
                };
            pending.abort();
            const message = diagnostic(error);
            retainCommittedDisplay();
            if (scrollEpoch === beforeScroll) {
                scrollX = previousTarget.x;
                scrollY = previousTarget.y;
                dimensions();
            }
            setLoadState('error', message);
            syncSemantic();
            return { inputRevision: own, status: 'rejected' };
        }
    }
    async function scrollTo({
        rowKey,
        columnKey,
        align = 'nearest',
    }: {
        rowKey?: string;
        columnKey?: string;
        align?: 'start' | 'center' | 'end' | 'nearest';
    }) {
        if (disposed) return { status: 'disposed' as const };
        if (!manifest || loading) return { status: 'pending' as const };
        const own = revision,
            source = input.source,
            controller = new AbortController();
        const abort = () => controller.abort();
        pending.signal.addEventListener('abort', abort, { once: true });
        const ownerSignal = pending.signal;
        try {
            const [row, column] = await withAbort(
                Promise.all([
                    rowKey
                        ? reader.locate({ version: source.version, axis: 'row', key: rowKey }, { signal: controller.signal })
                        : undefined,
                    columnKey
                        ? reader.locate({ version: source.version, axis: 'column', key: columnKey }, { signal: controller.signal })
                        : undefined,
                ]),
                controller.signal,
            );
            if (disposed || own !== revision || controller.signal.aborted)
                return {
                    status: disposed ? ('disposed' as const) : ('superseded' as const),
                };
            if (row && rowKey)
                assertLocation({
                    location: row,
                    request: { version: source.version, axis: 'row', key: rowKey },
                    plan: input.plan,
                    manifest,
                });
            if (column && columnKey)
                assertLocation({
                    location: column,
                    request: { version: source.version, axis: 'column', key: columnKey },
                    plan: input.plan,
                    manifest,
                });
            if (row?.status === 'missing' || column?.status === 'missing') return { status: 'missing' as const };
            const metrics = layoutMetrics(input.plan, width, height);
            const offset = (location: typeof row, current: number, step: number, extent: number) => {
                if (!location) return current;
                const rank = location.status === 'found' ? location.rank : location.status === 'hidden' ? location.ancestor.start : 0;
                const start = rank * step;
                if (align === 'center') return start - (extent - step) / 2;
                if (align === 'end') return start - extent + step;
                if (align === 'nearest' && start >= current && start + step <= current + extent) return current;
                return align === 'nearest' && start > current ? start - extent + step : start;
            };
            move(
                offset(column, scrollX, metrics.columnWidth, width - metrics.headerWidth - metrics.legendWidth),
                offset(row, scrollY, metrics.rowHeight, height - metrics.headerHeight),
            );
            if (raf) {
                cancelAnimationFrame(raf);
                raf = 0;
            }
            const receipt = await render({ row, column, scrollEpoch });
            return { status: receipt.status };
        } finally {
            ownerSignal.removeEventListener('abort', abort);
            controller.abort();
        }
    }
    async function focus(target: FocusTarget) {
        if (disposed) return { status: 'disposed' as const };
        if (target.rowKey || target.columnKey) {
            const located = await scrollTo(target);
            if (located.status !== 'committed') return located;
        }
        const item = target.headerKey
            ? frame?.headers.find((header) => header.key === target.headerKey)
            : frame?.hits.find((hit) => hit.id === target.markId);
        if (!item) return { status: 'pending' as const };
        focusId = item.id;
        headerFocus = item.kind === 'header';
        redrawOverlay();
        semantic.focus();
        return { status: 'found' as const };
    }
    async function withLifetime<T>(operation: (signal: AbortSignal) => Promise<T>, external?: AbortSignal, timeoutMs?: number): Promise<T> {
        const controller = new AbortController();
        const abort = () => controller.abort(external?.aborted ? external.reason : lifetime.signal.reason);
        for (const signal of [external, lifetime.signal]) signal?.addEventListener('abort', abort, { once: true });
        if (external?.aborted || lifetime.signal.aborted) abort();
        const timer =
            timeoutMs === undefined
                ? undefined
                : setTimeout(() => controller.abort(new Error('resource-limit: export time limit exceeded')), timeoutMs);
        try {
            controller.signal.throwIfAborted();
            return await operation(controller.signal);
        } finally {
            clearTimeout(timer);
            for (const signal of [external, lifetime.signal]) signal?.removeEventListener('abort', abort);
        }
    }
    async function waitForViewport(includePlaceholders: boolean, signal: AbortSignal): Promise<ViewportExportSnapshot> {
        if (revision === 0) await withAbort(ready, signal);
        const own = revision,
            x = scrollX,
            y = scrollY,
            layout = layoutRevision;
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                frameWaiters.delete(check);
                signal.removeEventListener('abort', abort);
            };
            const fail = (error: unknown) => {
                cleanup();
                reject(error);
            };
            const abort = () => fail(signal.reason ?? new DOMException('Export cancelled', 'AbortError'));
            const check = () => {
                if (signal.aborted) {
                    abort();
                    return;
                }
                if (disposed || loadState === 'error' || (loadState === 'preview' && !includePlaceholders)) {
                    fail(new Error('Worksheet has no complete committed viewport'));
                    return;
                }
                if (own !== revision || x !== scrollX || y !== scrollY || layout !== layoutRevision) {
                    fail(new Error('export-superseded: target viewport changed while waiting'));
                    return;
                }
                if (
                    !committed ||
                    committed.inputRevision !== own ||
                    committed.scrollX !== x ||
                    committed.scrollY !== y ||
                    !sameVersion(committed.version, requestedVersion) ||
                    loadState === 'stale' ||
                    (loadState !== 'complete' && !includePlaceholders)
                )
                    return;
                cleanup();
                resolve({
                    frame: committed.frame,
                    version: committed.version,
                    requestedVersion,
                    domainPlanKey: committed.input.plan.domainPlanKey,
                    state: loadState,
                    scroll: { x, y },
                    range: {
                        rows: committed.scene.rows.range,
                        columns: committed.scene.columns.range,
                    },
                    fontFamily: committed.input.plan.style?.fontFamily,
                    fontSize: committed.input.plan.style?.fontSize,
                    dpr: requestedDpr,
                });
            };
            frameWaiters.add(check);
            signal.addEventListener('abort', abort, { once: true });
            check();
        });
    }
    const exportViewport = (exportOptions: ViewportExportOptions, signal?: AbortSignal) =>
        withLifetime(
            async (live) => {
                const snapshot = await waitForViewport(exportOptions.includePlaceholders === true, live);
                return serializeViewport(snapshot, exportOptions, resources, live);
            },
            signal,
            limitsFor(exportOptions.limits).maxElapsedMs,
        );
    const exportRange = (exportOptions: RangeExportOptions, signal?: AbortSignal) => {
        const context = {
            plan: input.plan,
            source: input.source,
            viewport: { width, height, dpr: requestedDpr },
            resources,
            fontRevision: () => fontRevision,
        };
        return withLifetime((live) => serializeRange(context, exportOptions, live), signal);
    };
    const ready: Promise<UpdateReceipt> = Promise.resolve().then(() =>
        revision === 0
            ? update(initial)
            : {
                  inputRevision: 0,
                  status: disposed ? ('disposed' as const) : ('superseded' as const),
              },
    );
    return {
        ready,
        update,
        on<K extends keyof WorksheetEvents>(name: K, handler: (event: WorksheetEvents[K]) => void) {
            let set = listeners.get(name);
            if (!set) listeners.set(name, (set = new Set()));
            set.add(handler);
            return () => {
                set!.delete(handler);
            };
        },
        scrollToPosition: ({ x = scrollX, y = scrollY }: { x?: number; y?: number }) => move(x, y),
        scrollTo,
        focus,
        setSelection,
        requestCollapse,
        requestSort,
        rejectRequest: (requestId: string, reason: string) => requests.reject(requestId, reason),
        resize({ width: nextWidth, height: nextHeight, dpr }: { width: number; height: number; dpr?: number }) {
            if (disposed) return;
            if (options.autoResize !== false) throw new Error('invalid-option: manual resize requires autoResize: false');
            if (![nextWidth, nextHeight, dpr ?? 1].every((value) => Number.isFinite(value) && value > 0))
                throw new Error('invalid-option: viewport dimensions and DPR must be positive');
            manualWidth = nextWidth;
            manualHeight = nextHeight;
            requestedDpr = dpr ?? requestedDpr;
            onResize(true);
        },
        getViewState: () => {
            const displayed = committed?.frame;
            const interactive = loading || loadState === 'error' ? undefined : frame;
            return Object.freeze({
                inputRevision: revision,
                frameId: interactive?.frameId,
                displayedFrameId: displayed?.frameId,
                version: immutableSnapshot(frameVersion ?? input.source.version),
                requestedVersion: immutableSnapshot(requestedVersion),
                committedVersion: immutableSnapshot(committed?.version),
                committedInputRevision: committed?.inputRevision,
                get displayedFrame() {
                    return frameSnapshot(displayed);
                },
                displayedScroll: committed ? Object.freeze({ x: committed.scrollX, y: committed.scrollY }) : undefined,
                targetScroll: Object.freeze({ x: scrollX, y: scrollY }),
                loadState,
                focus: immutableSnapshot(focusTarget()),
                requests: immutableSnapshot(requests.snapshot()),
                selection: immutableSnapshot(currentSelection()),
                scrollX,
                scrollY,
                loading,
                get frame() {
                    return frameSnapshot(interactive);
                },
                manifest: immutableSnapshot(manifest),
                selected: Object.freeze([...selected]),
                selectedTargets: immutableSnapshot([...selections.values()]),
                pendingSelection: Object.freeze([...selected].filter((id) => !selections.has(id))),
                cacheWindows: resources.stats().layers.data.entries,
                resources: immutableSnapshot(resources.stats()),
                canvasCount: root.querySelectorAll('canvas').length,
            });
        },
        exportViewport,
        exportRange,
        async export(exportOptions: ViewportExportOptions, signal?: AbortSignal) {
            if (disposed) throw new Error('Worksheet has no complete committed viewport');
            return (await exportViewport(exportOptions, signal)).content;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            revision++;
            pending.abort();
            prefetch.abort();
            lifetime.abort();
            cancelAnimationFrame(raf);
            resize?.disconnect();
            dprMedia?.removeEventListener?.('change', onDpr);
            document.fonts?.removeEventListener?.('loadingdone', onFonts);
            requests.dispose();
            semantic.dispose();
            scroller.removeEventListener('scroll', onScroll);
            scroller.removeEventListener('wheel', onWheel);
            scroller.removeEventListener('keydown', onKey);
            scroller.removeEventListener('click', onClick);
            scroller.removeEventListener('pointerdown', onPointerDown);
            scroller.removeEventListener('pointermove', onPointerMove);
            scroller.removeEventListener('pointerup', onPointerUp);
            scroller.removeEventListener('pointercancel', onPointerCancel);
            scroller.removeEventListener('pointerleave', onPointerLeave);
            listeners.clear();
            reader.dispose();
            committed?.reader.dispose();
            sceneCache.clear();
            resources.dispose();
            selected.clear();
            selections.clear();
            pendingTargets.clear();
            acceptedInput = undefined;
            lastScene = undefined;
            committed = undefined;
            loadState = 'disposed';
            wakeFrameWaiters();
            loading = false;
            frameVersion = undefined;
            frame = undefined;
            manifest = undefined;
            domains = undefined;
            if (paint instanceof HTMLCanvasElement) {
                paint.width = 0;
                paint.height = 0;
            } else paint.replaceChildren();
            svgPaint = undefined;
            root.replaceChildren();
            root.remove();
            const version = input.source.version,
                unavailable = async (): Promise<never> => {
                    throw new Error('disposed');
                };
            input = {
                plan: {
                    bindings: [],
                    rows: { facets: [], positions: [] },
                    columns: { facets: [], positions: [] },
                    mark: 'point',
                    domainPlanKey: 'disposed',
                },
                source: {
                    version,
                    describe: unavailable,
                    readAxis: unavailable,
                    readDomains: unavailable,
                    readPaneData: unavailable,
                    locate: unavailable,
                },
            };
            initial = input;
        },
    };
}
