import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { parse, View } from 'vega';
import { continuousColor, darkTheme, lightTheme, type Theme } from './color';
import { compileWorksheet, executePlan } from './compiler';
import { valueKey } from './keys';
import { formatTick, setTextMeasure } from './layout';
import { memberLabel } from './time';
import { buildModel } from './model';
import { buildScene, type Primitive, type Scene } from './scene';
import { sceneData, sceneToPNG, sceneToSVG, vegaSpec } from './vegaBackend';
import { resultTables, type ResultTable } from './export';
import type { Computation, Row, Selection, WorksheetSpec } from './types';

export interface WorksheetHandle {
    /** The whole sheet, not only the part in the window, with headers, axes and legend. */
    exportSVG(): Promise<string>;
    /**
     * The whole sheet as a PNG data URL, at `scale` device pixels per CSS pixel. A sheet too
     * large for a canvas at that scale is drawn at the largest scale that fits.
     */
    exportPNG(scale?: number): Promise<string>;
    /** The records behind the marks, one table per query that is drawn. */
    exportRecords(): ResultTable[];
}
// The canvas limits that hold across current browsers.
const maxCanvasSide = 16_000, maxCanvasArea = 64_000_000;
export interface WorksheetProps {
    spec: WorksheetSpec;
    computation: Computation;
    /** Upper bound of the scroll window. A shorter worksheet takes only the height it needs. */
    height?: number;
    /** Called with every selected mark. Click selects one, Ctrl or Cmd click adds or removes, a click on empty space or Escape clears. */
    onSelectionChange?: (selections: Selection[]) => void;
    /**
     * Called when the sheet cannot be drawn: the spec does not compile, a query fails, or the data
     * does not fit, with the message shown in its place. Called with '' once it draws again.
     */
    onError?: (message: string) => void;
    /** Surface, text, rule and mark colors. Pass the host's own surface color as `paper` so the sheet blends in, and its palette so marks match its other charts. */
    theme?: 'light' | 'dark' | Theme;
    /**
     * Draws nothing but the chart: no status line, no frame around the scroll area and no
     * panel listing the selected records. For hosts that already provide that chrome.
     */
    compact?: boolean;
}
// Header widths and label truncation use the same font the canvas draws with.
if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d');
    if (context) setTextMeasure((text, fontSize, fontWeight) => {
        context.font = `${fontWeight} ${fontSize}px system-ui, sans-serif`;
        return context.measureText(text).width;
    });
}
const emptyScene = (background: string): Scene => ({ width: 1, height: 1, items: [], visiblePanes: 0, background, legend: 'none' });
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

function VegaViewport({ scene, onClick }: { scene: Scene; onClick: (item: Primitive | undefined, additive: boolean) => void }) {
    const host = useRef<HTMLDivElement>(null);
    const tip = useRef<HTMLDivElement>(null);
    const instance = useRef<View | null>(null);
    const click = useRef(onClick);
    click.current = onClick;
    const [error, setError] = useState('');
    useEffect(() => {
        const view = new View(parse(vegaSpec(emptyScene(scene.background))), { renderer: 'canvas' }).initialize(host.current!);
        instance.current = view;
        view.addEventListener('click', (event, item) => {
            const mouse = event as MouseEvent;
            click.current(item?.datum as Primitive | undefined, mouse.ctrlKey || mouse.metaKey);
        });
        // The tooltip follows the pointer and is moved without a React render.
        const hide = () => { if (tip.current) tip.current.style.visibility = 'hidden'; };
        view.addEventListener('mousemove', (event, item) => {
            const box = tip.current, text = (item?.datum as Primitive | undefined)?.tooltip;
            if (!box || !text) return hide();
            if (box.textContent !== text) box.textContent = text;
            const area = host.current!.getBoundingClientRect();
            const x = (event as MouseEvent).clientX - area.left, y = (event as MouseEvent).clientY - area.top;
            // Flip to the other side of the pointer near the right and bottom edges.
            box.style.left = `${x + 14 + box.offsetWidth > area.width ? Math.max(0, x - 14 - box.offsetWidth) : x + 14}px`;
            box.style.top = `${y + 16 + box.offsetHeight > area.height ? Math.max(0, y - 12 - box.offsetHeight) : y + 16}px`;
            box.style.visibility = 'visible';
        });
        view.addEventListener('mouseout', hide);
        return () => { instance.current = null; view.finalize(); };
    }, []);
    useEffect(() => {
        let active = true;
        const view = instance.current;
        // What was under the pointer may have moved or gone; the next pointer move brings the tooltip back.
        if (tip.current) tip.current.style.visibility = 'hidden';
        if (view) {
            view.width(scene.width).height(scene.height).background(scene.background);
            for (const [name, values] of sceneData(scene)) view.data(name, values);
            void view.runAsync().then(() => { if (active) setError(''); }, reason => { if (active) setError(message(reason)); });
        }
        return () => { active = false; };
    }, [scene]);
    return <div style={{ position: 'relative', width: scene.width, height: scene.height }}>
        <div ref={host} role="img" aria-label={`Worksheet chart, ${scene.visiblePanes} visible panes.`} />
        <div ref={tip} role="tooltip" style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', maxWidth: 360, whiteSpace: 'pre-line', background: '#172033', color: '#fff', borderRadius: 6, padding: '8px 12px', fontSize: 12, lineHeight: 1.5, pointerEvents: 'none', zIndex: 1 }} />
        {error ? <div role="alert">{error}</div> : null}
    </div>;
}

export const Worksheet = forwardRef<WorksheetHandle, WorksheetProps>(function Worksheet({ spec, computation, height = 570, onSelectionChange, onError, theme: themeProp = 'light', compact = false }, ref) {
    const theme = useMemo<Theme>(() => themeProp === 'light' ? lightTheme : themeProp === 'dark' ? darkTheme : themeProp,
        [typeof themeProp === 'string' ? themeProp : JSON.stringify(themeProp)]);
    const compiled = useMemo(() => {
        try { return { plan: compileWorksheet(spec), error: '' }; }
        catch (error) { return { plan: undefined, error: message(error) }; }
    }, [spec]);
    const queryKey = compiled.plan ? JSON.stringify(compiled.plan.tasks.map(t => t.payload)) : '';
    const latestPlan = useRef(compiled.plan);
    latestPlan.current = compiled.plan;
    const [result, setResult] = useState<{ key: string; data?: Map<string, Row[]>; error?: string }>();
    const [loading, setLoading] = useState(false);
    const [selection, setSelection] = useState<ReadonlyMap<string, Selection>>(new Map());
    const notify = useRef(onSelectionChange);
    notify.current = onSelectionChange;
    const current = useRef(selection);
    current.current = selection;
    const select = (next: ReadonlyMap<string, Selection>) => { setSelection(next); notify.current?.([...next.values()]); };
    useEffect(() => {
        const plan = latestPlan.current;
        if (!plan) { setLoading(false); setResult(undefined); return; }
        const controller = new AbortController();
        setLoading(true);
        // Marks of the previous result may not exist in the next one.
        if (current.current.size) select(new Map());
        void executePlan(plan, computation, controller.signal).then(data => {
            if (!controller.signal.aborted) { setResult({ key: queryKey, data }); setLoading(false); }
        }, error => {
            if (!controller.signal.aborted) { setResult({ key: queryKey, error: message(error) }); setLoading(false); }
        });
        return () => controller.abort();
    }, [queryKey, computation]);
    const scrollHost = useRef<HTMLDivElement>(null);
    const [viewport, setViewport] = useState({ x: 0, y: 0, width: 800, height });
    // Only a fitted axis makes the layout depend on the window size.
    const fit = compiled.plan?.spec.fit;
    const targetWidth = fit === 'width' || fit === 'both' ? viewport.width : 0;
    const targetHeight = fit === 'height' || fit === 'both' ? height - 2 : 0;
    // Row headers get at most 40% of the window. Rounded so that dragging a window edge does not rebuild the layout on every pixel.
    const headerWidth = Math.max(96, Math.round(viewport.width * 0.4 / 24) * 24);
    const built = useMemo(() => {
        if (!compiled.plan || result?.key !== queryKey || !result.data) return undefined;
        try { return { model: buildModel(compiled.plan, result.data, { width: targetWidth, height: targetHeight, headerWidth }), error: '' }; }
        catch (error) { return { model: undefined, error: message(error) }; }
    }, [compiled.plan, result, queryKey, targetWidth, targetHeight, headerWidth]);
    const model = built?.model;
    // Room for a horizontal scroll bar, so a short worksheet does not gain a vertical one.
    const hostHeight = model ? Math.min(height, model.height + 18) : height;
    useEffect(() => {
        const host = scrollHost.current!;
        const read = () => setViewport(v => {
            const next = { x: host.scrollLeft, y: host.scrollTop, width: host.clientWidth, height: host.clientHeight };
            return next.x === v.x && next.y === v.y && next.width === v.width && next.height === v.height ? v : next;
        });
        const observer = new ResizeObserver(read);
        observer.observe(host);
        read();
        let frame = 0;
        const scroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(read); };
        host.addEventListener('scroll', scroll, { passive: true });
        return () => { observer.disconnect(); cancelAnimationFrame(frame); host.removeEventListener('scroll', scroll); };
    }, []);
    // The scroll range can shrink when the worksheet changes; the browser clamps the offsets without a scroll event.
    useEffect(() => {
        const host = scrollHost.current!;
        setViewport(v => v.x === host.scrollLeft && v.y === host.scrollTop ? v : { ...v, x: host.scrollLeft, y: host.scrollTop });
    }, [model, hostHeight]);
    const selected = useMemo(() => new Set(selection.keys()), [selection]);
    const scene = useMemo(() => model ? buildScene(model, viewport, { selected, theme }) : emptyScene(theme.paper), [model, viewport, selected, theme]);
    useImperativeHandle(ref, () => {
        const whole = () => {
            if (!model || loading) throw new Error('Wait for the worksheet query to finish.');
            return buildScene(model, { x: 0, y: 0, width: model.width, height: model.height }, { theme });
        };
        return {
            async exportSVG() {
                const scene = whole();
                if (scene.width * scene.height > 100_000_000) throw new Error('Full export exceeds the V0 size limit. Filter the worksheet first.');
                return sceneToSVG(scene);
            },
            async exportPNG(scale = 2) {
                const scene = whole();
                const fit = Math.min(scale, maxCanvasSide / scene.width, maxCanvasSide / scene.height, Math.sqrt(maxCanvasArea / (scene.width * scene.height)));
                if (fit < 0.25) throw new Error('The worksheet is too large for an image. Filter it first, or export SVG.');
                return sceneToPNG(scene, fit);
            },
            exportRecords() {
                if (!compiled.plan || loading || result?.key !== queryKey || !result.data) throw new Error('Wait for the worksheet query to finish.');
                return resultTables(compiled.plan, result.data);
            },
        };
    }, [model, loading, theme, compiled.plan, result, queryKey]);
    const error = compiled.error || built?.error || (result?.key === queryKey ? result.error : '');
    const colorField = model?.plan.spec.color ? model.plan.spec.instances[model.plan.spec.color] : undefined;
    const report = useRef(onError);
    report.current = onError;
    useEffect(() => { report.current?.(error || ''); }, [error]);
    return <div style={{ position: 'relative', color: theme.text, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
        {/* Compact hosts still get the status, for screen readers and tests, without it taking space. */}
        <div aria-live="polite" data-testid="worksheet-status" style={compact
            ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }
            : { display: 'flex', gap: 16, padding: '10px 0', flexWrap: 'wrap', color: theme.muted }}>
            {loading ? 'Querying…' : model ? `${model.panes.length} panes · ${scene.visiblePanes} visible · ${model.rows.leaves.length} × ${model.columns.leaves.length} positions · ${model.plan.tasks.length} query tasks · ${model.panes.reduce((n, p) => n + p.records.length, 0)} marks` : 'Worksheet'}
        </div>
        {/* In a window too narrow for the legend strip the colors are named here instead. */}
        {model && colorField && scene.legend === 'omitted' ? <div data-testid="worksheet-legend" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 6, fontSize: 11 }}>
            <strong>{colorField.label}</strong>
            {model.colorScale
                ? <><span>{formatTick(model.colorScale.domain[0])}</span><span style={{ width: 72, height: 8, borderRadius: 2, background: `linear-gradient(to right, ${[0, .25, .5, .75, 1].map(t => continuousColor(model.colorScale!, model.colorScale!.domain[0] + (model.colorScale!.domain[1] - model.colorScale!.domain[0]) * t, theme, model.plan.spec.mark === 'rect')).join(', ')})` }} /><span>{formatTick(model.colorScale.domain[1])}</span></>
                : <>{model.colors.slice(0, 12).map((c, i) => <span key={valueKey(c)}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: theme.category[i % theme.category.length], marginRight: 4 }} />{memberLabel(colorField, c)}</span>)}{model.colors.length > 12 ? <span>+{model.colors.length - 12} more</span> : null}</>}
        </div> : null}
        {error ? <p role="alert" style={{ color: '#d92d20' }}>{error}</p> : null}
        {!loading && model && !model.panes.length ? <p>No data matches these filters.</p> : null}
        <div ref={scrollHost} data-testid="worksheet-scroll" aria-label="Scrollable worksheet" tabIndex={0} onKeyDown={event => { if (event.key === 'Escape' && selection.size) select(new Map()); }} style={{ position: 'relative', overflow: 'auto', height: hostHeight, background: theme.paper, ...(compact ? {} : { border: `1px solid ${theme.line}`, borderRadius: 8 }) }}>
            <div style={{ width: model?.width ?? 1, height: model?.height ?? 1, position: 'relative' }}>
                <div style={{ position: 'sticky', top: 0, left: 0, width: viewport.width, height: viewport.height, visibility: loading || error ? 'hidden' : 'visible' }}>
                    <VegaViewport scene={scene} onClick={(item, additive) => {
                        const hit = item?.selection;
                        if (!hit) { if (!additive && selection.size && (!item || item.layer === 'body')) select(new Map()); return; }
                        const next = new Map(additive ? selection : []);
                        if (additive && next.has(hit.id)) next.delete(hit.id); else next.set(hit.id, hit);
                        select(next);
                    }} />
                </div>
            </div>
        </div>
        {selection.size && !compact ? <details style={{ marginTop: 12 }}><summary data-testid="worksheet-selection-count">{selection.size} selected · Esc clears</summary><pre data-testid="worksheet-selection" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify([...selection.values()].map(s => ({ predicates: s.predicates, values: s.values })), null, 2)}</pre></details> : null}
    </div>;
});
