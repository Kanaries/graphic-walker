import type { RenderDataSource, RenderDataManifest, RenderPlan, ReadVersion, DomainBatch, AxisWindow, PaneBatch } from '../core/types';
import { buildScene, layoutMetrics } from '../scene/build';
import { contains, type HitRegion, type SceneFrame } from '../scene/types';
import { paintCanvas } from '../backends/canvas';
import { createSvgBackend } from '../backends/svg';
import { ScrollMapper } from './scroll';
import { assertS0Capabilities } from '../core/capabilities';
import { assertCompleteWindow } from '../core/validateWindow';

export interface WorksheetInput {
    plan: RenderPlan;
    source: RenderDataSource;
    backend?: 'canvas' | 'svg';
}
export interface UpdateReceipt {
    inputRevision: number;
    status: 'committed' | 'superseded' | 'rejected' | 'disposed';
    frameId?: number;
}
export interface WorksheetEvents {
    ready: { frameId: number };
    selectionChange: { targets: readonly HitRegion[]; frameId: number };
    diagnostic: { code: string; message: string };
}
const sameVersion = (a: ReadVersion, b: ReadVersion) =>
    a.sourceId === b.sourceId && a.snapshotId === b.snapshotId && a.presentationId === b.presentationId;
/** S0 controller. One paint root, a native scroll host, and bounded window caching. */
export function createWorksheet(host: HTMLElement, initial: WorksheetInput) {
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
    const cache = new Map<string, { rows: AxisWindow; columns: AxisWindow; panes: PaneBatch }>();
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
    function emit<K extends keyof WorksheetEvents>(name: K, event: WorksheetEvents[K]) {
        for (const listener of listeners.get(name) ?? []) listener(event);
    }
    function setStatus(message: string) {
        status.textContent = message;
        status.hidden = !message;
        root.setAttribute('aria-busy', String(loading));
    }
    function createPaint() {
        paint?.remove();
        if (input.backend === 'svg') {
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
    function draw(next: SceneFrame) {
        if (paint instanceof HTMLCanvasElement) paintCanvas(paint, next);
        else svgPaint!(next);
    }
    function physicalSync() {
        scroller.scrollLeft = mx.toPhysical(scrollX);
        scroller.scrollTop = my.toPhysical(scrollY);
        expectedX = scroller.scrollLeft;
        expectedY = scroller.scrollTop;
    }
    function dimensions() {
        width = Math.max(1, scroller.clientWidth);
        height = Math.max(1, scroller.clientHeight);
        const m = layoutMetrics(input.plan, width),
            bodyWidth = Math.max(1, width - m.headerWidth),
            bodyHeight = Math.max(1, height - m.headerHeight);
        mx = new ScrollMapper((manifest?.columnLeafCount ?? 0) * m.columnWidth, bodyWidth);
        my = new ScrollMapper((manifest?.rowLeafCount ?? 0) * m.rowHeight, bodyHeight);
        spacer.style.width = `${width + mx.physicalMax}px`;
        spacer.style.height = `${height + my.physicalMax}px`;
        scrollX = mx.clamp(scrollX);
        scrollY = my.clamp(scrollY);
        physicalSync();
    }
    async function render(): Promise<UpdateReceipt> {
        const own = revision;
        if (disposed) return { inputRevision: own, status: 'disposed' };
        if (!manifest || !domains) return { inputRevision: own, status: 'rejected' };
        pending.abort();
        pending = new AbortController();
        const signal = pending.signal;
        const source = input.source,
            plan = input.plan,
            version = source.version;
        const x = scrollX,
            y = scrollY,
            m = layoutMetrics(plan, width),
            frameWidth = width,
            frameHeight = height;
        const rowStart = Math.floor(y / m.rowHeight),
            colStart = Math.floor(x / m.columnWidth);
        const rows = {
            start: rowStart,
            end: Math.min(manifest.rowLeafCount, rowStart + Math.max(0, Math.ceil((height - m.headerHeight) / m.rowHeight)) + 1),
        };
        const columns = {
            start: colStart,
            end: Math.min(manifest.columnLeafCount, colStart + Math.max(0, Math.ceil((width - m.headerWidth) / m.columnWidth)) + 1),
        };
        const key = JSON.stringify([version, rows, columns]);
        loading = true;
        setStatus('Loading worksheet…');
        try {
            let batch = cache.get(key);
            if (!batch) {
                const [rowData, colData, paneData] = await Promise.all([
                    source.readAxis({ version, axis: 'row', range: rows }, signal),
                    source.readAxis({ version, axis: 'column', range: columns }, signal),
                    source.readPaneData({ version, windows: [{ rows, columns }] }, signal),
                ]);
                if (![rowData, colData, paneData].every((v) => sameVersion(v.version, version)))
                    throw new Error('source-contract-violation: mismatched response version');
                if (paneData.nextCursor) throw new Error('unsupported-source-paging: S0 requires complete pane batches');
                if (paneData.panes.reduce((n, p) => n + p.records.length, 0) > 20_000)
                    throw new Error('resource-limit: S0 window exceeds 20,000 records');
                batch = { rows: rowData, columns: colData, panes: paneData };
            }
            if (
                disposed ||
                signal.aborted ||
                own !== revision ||
                x !== scrollX ||
                y !== scrollY ||
                frameWidth !== width ||
                frameHeight !== height
            )
                return { inputRevision: own, status: disposed ? 'disposed' : 'superseded' };
            assertCompleteWindow({ plan, version, manifest, window: { rows, columns }, ...batch, domains });
            cache.delete(key);
            cache.set(key, batch);
            while (cache.size > 8) cache.delete(cache.keys().next().value!);
            const next = buildScene({
                plan,
                ...batch,
                domains,
                width: frameWidth,
                height: frameHeight,
                scrollX: x,
                scrollY: y,
                frameId: ++frameCounter,
                selected,
            });
            for (const hit of next.hits) if (selected.has(hit.id)) selections.set(hit.id, hit);
            draw(next);
            frame = next;
            loading = false;
            setStatus(manifest.status === 'preview' ? 'Preview: incomplete input' : '');
            emit('ready', { frameId: next.frameId });
            return { inputRevision: own, status: 'committed', frameId: next.frameId };
        } catch (error) {
            if (disposed || signal.aborted || own !== revision) return { inputRevision: own, status: disposed ? 'disposed' : 'superseded' };
            pending.abort();
            const message = error instanceof Error ? error.message : String(error);
            frame = undefined;
            createPaint();
            loading = false;
            setStatus(message);
            emit('diagnostic', { code: message.split(':')[0], message });
            return { inputRevision: own, status: 'rejected' };
        }
    }
    function schedule() {
        if (!raf && !disposed)
            raf = requestAnimationFrame(() => {
                raf = 0;
                void render();
            });
    }
    function move(x: number, y: number) {
        scrollX = mx.clamp(x);
        scrollY = my.clamp(y);
        physicalSync();
        schedule();
    }
    const onScroll = () => {
        if (Math.abs(scroller.scrollLeft - expectedX) > 0.5) scrollX = mx.toLogical(scroller.scrollLeft);
        if (Math.abs(scroller.scrollTop - expectedY) > 0.5) scrollY = my.toLogical(scroller.scrollTop);
        expectedX = scroller.scrollLeft;
        expectedY = scroller.scrollTop;
        schedule();
    };
    const onWheel = (e: WheelEvent) => {
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
        if (loading || !frame) return;
        const bounds = scroller.getBoundingClientRect(),
            x = e.clientX - bounds.left,
            y = e.clientY - bounds.top;
        const hit = [...frame.hits].reverse().find((h) => contains(h.box, x, y) && contains(h.clip, x, y));
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            selected.clear();
            selections.clear();
        }
        if (hit) {
            if (selected.has(hit.id)) {
                selected.delete(hit.id);
                selections.delete(hit.id);
            } else {
                selected.add(hit.id);
                selections.set(hit.id, hit);
            }
        }
        emit('selectionChange', { targets: [...selections.values()], frameId: frame.frameId });
        schedule();
    };
    scroller.addEventListener('scroll', onScroll);
    scroller.addEventListener('wheel', onWheel, { passive: false });
    scroller.addEventListener('keydown', onKey);
    scroller.addEventListener('click', onClick);
    const resize = new ResizeObserver(() => {
        dimensions();
        schedule();
    });
    resize.observe(root);
    async function update(next: WorksheetInput): Promise<UpdateReceipt> {
        const own = ++revision;
        pending.abort();
        pending = new AbortController();
        const signal = pending.signal;
        if (disposed) return { inputRevision: own, status: 'disposed' };
        const reuse = next.source === input.source && next.plan === input.plan && manifest && domains;
        if (next.source.version.sourceId !== input.source.version.sourceId) {
            selected.clear();
            selections.clear();
            emit('selectionChange', { targets: [], frameId: frame?.frameId ?? 0 });
        } else if (next.source.version.snapshotId !== input.source.version.snapshotId) {
            selections.clear();
        }
        input = next;
        frame = undefined;
        loading = true;
        setStatus('Loading worksheet…');
        createPaint();
        if (reuse) {
            dimensions();
            return render();
        }
        manifest = undefined;
        domains = undefined;
        cache.clear();
        try {
            assertS0Capabilities(input.plan);
            const [description, domainData] = await Promise.all([
                input.source.describe(signal),
                input.source.readDomains(
                    {
                        version: input.source.version,
                        fieldRefs: [
                            ...new Set([
                                ...input.plan.rows.positions,
                                ...input.plan.columns.positions,
                                ...(input.plan.channels?.color && 'fieldRef' in input.plan.channels.color
                                    ? [input.plan.channels.color.fieldRef]
                                    : []),
                            ]),
                        ],
                    },
                    signal,
                ),
            ]);
            if (disposed || signal.aborted || own !== revision) return { inputRevision: own, status: disposed ? 'disposed' : 'superseded' };
            if (
                !sameVersion(description.version, input.source.version) ||
                !sameVersion(domainData.version, input.source.version) ||
                description.domainPlanKey !== input.plan.domainPlanKey
            )
                throw new Error('source-contract-violation: manifest or domain mismatch');
            manifest = description;
            domains = domainData;
            dimensions();
            return await render();
        } catch (error) {
            if (disposed || signal.aborted || own !== revision) return { inputRevision: own, status: disposed ? 'disposed' : 'superseded' };
            pending.abort();
            frame = undefined;
            createPaint();
            loading = false;
            const message = error instanceof Error ? error.message : String(error);
            setStatus(message);
            emit('diagnostic', { code: message.split(':')[0], message });
            return { inputRevision: own, status: 'rejected' };
        }
    }
    const ready = update(initial);
    return {
        ready,
        update,
        on<K extends keyof WorksheetEvents>(name: K, handler: (event: WorksheetEvents[K]) => void) {
            let set = listeners.get(name);
            if (!set) listeners.set(name, (set = new Set()));
            set.add(handler);
            return () => set!.delete(handler);
        },
        scrollToPosition: ({ x = scrollX, y = scrollY }: { x?: number; y?: number }) => move(x, y),
        async scrollTo({ rowKey, columnKey }: { rowKey?: string; columnKey?: string }) {
            const own = revision,
                source = input.source,
                signal = pending.signal,
                m = layoutMetrics(input.plan, width);
            const [r, c] = await Promise.all([
                rowKey ? source.locate({ version: source.version, axis: 'row', key: rowKey }, signal) : undefined,
                columnKey ? source.locate({ version: source.version, axis: 'column', key: columnKey }, signal) : undefined,
            ]);
            if (!disposed && own === revision)
                move(c?.status === 'found' ? c.rank * m.columnWidth : scrollX, r?.status === 'found' ? r.rank * m.rowHeight : scrollY);
        },
        getViewState: () => ({
            inputRevision: revision,
            version: input.source.version,
            scrollX,
            scrollY,
            loading,
            frame,
            manifest,
            selected: [...selected],
            selectedTargets: [...selections.values()],
            pendingSelection: [...selected].filter((id) => !selections.has(id)),
            cacheWindows: cache.size,
            canvasCount: root.querySelectorAll('canvas').length,
        }),
        async export({ format }: { format: 'svg' | 'png' }) {
            if (!frame || loading || disposed) throw new Error('Worksheet has no complete committed viewport');
            if (format === 'svg') {
                const target = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                createSvgBackend(target)(frame);
                return new XMLSerializer().serializeToString(target);
            }
            const target = document.createElement('canvas');
            paintCanvas(target, frame);
            return target.toDataURL('image/png');
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            revision++;
            pending.abort();
            cancelAnimationFrame(raf);
            resize.disconnect();
            scroller.removeEventListener('scroll', onScroll);
            scroller.removeEventListener('wheel', onWheel);
            scroller.removeEventListener('keydown', onKey);
            scroller.removeEventListener('click', onClick);
            listeners.clear();
            cache.clear();
            selected.clear();
            selections.clear();
            frame = undefined;
            manifest = undefined;
            domains = undefined;
            if (paint instanceof HTMLCanvasElement) {
                paint.width = 0;
                paint.height = 0;
            } else paint.replaceChildren();
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
        },
    };
}
