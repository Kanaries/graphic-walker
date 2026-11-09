import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { parse, View } from 'vega';
import { compileWorksheet, executePlan } from './compiler';
import { displayValue, valueKey } from './keys';
import { setTextMeasure } from './layout';
import { buildModel } from './model';
import { buildScene, palette, type Primitive, type Scene } from './scene';
import { sceneData, sceneToSVG, vegaSpec } from './vegaBackend';
import type { Computation, Row, Selection, WorksheetSpec } from './types';

export interface WorksheetHandle { exportSVG(): Promise<string> }
export interface WorksheetProps {
    spec: WorksheetSpec;
    computation: Computation;
    /** Upper bound of the scroll window. A shorter worksheet takes only the height it needs. */
    height?: number;
    /** Called with every selected mark. Click selects one, Ctrl or Cmd click adds or removes, a click on empty space or Escape clears. */
    onSelectionChange?: (selections: Selection[]) => void;
}
// Header widths and label truncation use the same font the canvas draws with.
if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d');
    if (context) setTextMeasure((text, fontSize, fontWeight) => {
        context.font = `${fontWeight} ${fontSize}px system-ui, sans-serif`;
        return context.measureText(text).width;
    });
}
const emptyScene: Scene = { width: 1, height: 1, items: [], visiblePanes: 0 };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

function VegaViewport({ scene, onClick }: { scene: Scene; onClick: (item: Primitive | undefined, additive: boolean) => void }) {
    const host = useRef<HTMLDivElement>(null);
    const tip = useRef<HTMLDivElement>(null);
    const instance = useRef<View | null>(null);
    const click = useRef(onClick);
    click.current = onClick;
    const [error, setError] = useState('');
    useEffect(() => {
        const view = new View(parse(vegaSpec(emptyScene)), { renderer: 'canvas' }).initialize(host.current!);
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
        if (view) {
            view.width(scene.width).height(scene.height);
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

export const Worksheet = forwardRef<WorksheetHandle, WorksheetProps>(function Worksheet({ spec, computation, height = 570, onSelectionChange }, ref) {
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
    const built = useMemo(() => {
        if (!compiled.plan || result?.key !== queryKey || !result.data) return undefined;
        try { return { model: buildModel(compiled.plan, result.data, { width: targetWidth, height: targetHeight }), error: '' }; }
        catch (error) { return { model: undefined, error: message(error) }; }
    }, [compiled.plan, result, queryKey, targetWidth, targetHeight]);
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
    const scene = useMemo(() => model ? buildScene(model, viewport, { selected }) : emptyScene, [model, viewport, selected]);
    useImperativeHandle(ref, () => ({
        async exportSVG() {
            if (!model || loading) throw new Error('Wait for the worksheet query to finish.');
            if (model.width * model.height > 100_000_000) throw new Error('Full export exceeds the V0 size limit. Filter the worksheet first.');
            return sceneToSVG(buildScene(model, { x: 0, y: 0, width: model.width, height: model.height }));
        },
    }), [model, loading]);
    const error = compiled.error || built?.error || (result?.key === queryKey ? result.error : '');
    return <div style={{ color: '#263248', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
        <div aria-live="polite" data-testid="worksheet-status" style={{ display: 'flex', gap: 16, padding: '10px 0', flexWrap: 'wrap' }}>
            {loading ? 'Querying…' : model ? `${model.panes.length} panes · ${scene.visiblePanes} visible · ${model.rows.leaves.length} × ${model.columns.leaves.length} positions · ${model.plan.tasks.length} query tasks · ${model.panes.reduce((n, p) => n + p.records.length, 0)} marks` : 'Worksheet'}
            {model?.colors.map((c, i) => <span key={valueKey(c)}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: palette[i % palette.length], marginRight: 5 }} />{displayValue(c)}</span>)}
        </div>
        {error ? <p role="alert" style={{ color: '#b42318' }}>{error}</p> : null}
        {!loading && model && !model.panes.length ? <p>No data matches these filters.</p> : null}
        <div ref={scrollHost} data-testid="worksheet-scroll" aria-label="Scrollable worksheet" tabIndex={0} onKeyDown={event => { if (event.key === 'Escape' && selection.size) select(new Map()); }} style={{ position: 'relative', overflow: 'auto', height: hostHeight, border: '1px solid #dfe5ef', borderRadius: 8, background: 'white' }}>
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
        {selection.size ? <details style={{ marginTop: 12 }}><summary data-testid="worksheet-selection-count">{selection.size} selected · Esc clears</summary><pre data-testid="worksheet-selection" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify([...selection.values()].map(s => ({ predicates: s.predicates, values: s.values })), null, 2)}</pre></details> : null}
    </div>;
});
