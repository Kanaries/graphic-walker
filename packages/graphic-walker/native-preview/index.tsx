import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import { Worksheet, compileWorksheet, darkTheme, lightTheme, tableToCSV, type Computation, type Theme, type WorksheetHandle } from '@kanaries/worksheet-renderer';
import type { IChart, IDataQueryWorkflowStep } from '../src/interfaces';
import { registerNativeRenderer, type NativeRendererProps } from '../src/renderer/nativeRegistry';
import { toWorkflow } from '../src/utils/workflow';
import { chartToWorksheet } from './adapter';
import { chartFormats } from './formats';

/** Red, green, blue and alpha of a CSS rgb(), rgba() or #rrggbb color. Alpha is 1 where the color names none. */
function channels(color: string): [number, number, number, number] {
    const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())?.[1];
    if (hex) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
    const [r = 255, g = 255, b = 255, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);
    return [r, g, b, a];
}
const isDark = (color: string) => { const [r, g, b] = channels(color); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45; };
/** `top` painted over `bottom`, as one opaque color. The sheet's frozen headers must hide what scrolls under them. */
function over(top: string | undefined, bottom: string): string {
    if (!top) return bottom;
    const [r, g, b, a] = channels(top), under = channels(bottom);
    if (a <= 0) return bottom;
    return `rgb(${[r, g, b].map((v, i) => Math.round(v * a + under[i] * (1 - a))).join(', ')})`;
}

/**
 * The color of the surface the chart sits on: the first opaque background above it, through
 * shadow roots. The editor has no single value for this; its look comes from classes and
 * from the system setting. Until one is found, `fallback` stands in.
 */
function useSurface(host: RefObject<HTMLElement | null>, fallback: string): string {
    const [surface, setSurface] = useState<string>();
    useEffect(() => {
        const ancestors: Element[] = [];
        for (let node: Node | null = host.current; node; node = node.parentNode ?? (node as ShadowRoot).host ?? null) {
            if (node instanceof Element) ancestors.push(node);
        }
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const read = () => setSurface(ancestors.map((element) => getComputedStyle(element).backgroundColor).find((color) => channels(color)[3] > 0.9));
        read();
        // A theme switch shows up as a class or style change on some ancestor, or as a system change.
        const observer = new MutationObserver(read);
        for (const element of ancestors) observer.observe(element, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
        media.addEventListener('change', read);
        return () => { observer.disconnect(); media.removeEventListener('change', read); };
    }, [host]);
    return surface ?? fallback;
}

/**
 * The worksheet renderer inside the editor. The chart is mapped on every change and is
 * never rewritten. Filters and computed fields go through the editor's own workflow
 * builder; only the grouping step comes from the worksheet, which asks for one result
 * per grain it draws.
 */
function NativeWorksheet({ chart, fields, computation, colors, locale, onUnsupported, handle, onStatusChange, onMarkClick }: NativeRendererProps) {
    const adapted = useMemo(() => chartToWorksheet(chart), [chart]);
    const aggregated = chart.config.defaultAggregated;
    // Everything the editor would run before its own view step: row filters, computed fields, filters on those.
    const before = useMemo(() => {
        const steps = toWorkflow(chart.encodings.filters, fields, adapted.viewDimensions, adapted.viewMeasures, aggregated, 'none', chart.config.folds, undefined, chart.config.timezoneDisplayOffset);
        const view = steps.findIndex((step) => step.type === 'view');
        return JSON.stringify(view < 0 ? [] : steps.slice(0, view));
    }, [chart, fields, adapted, aggregated]);
    // `before` is compared as text so that an unrelated store update does not restart the queries.
    const run = useMemo<Computation>(() => {
        const steps: IDataQueryWorkflowStep[] = JSON.parse(before);
        return (payload) => {
            const view = payload.workflow.find((step) => step.type === 'view');
            const query = view && view.type === 'view' ? view.query[0] : undefined;
            if (!query) return Promise.resolve([]);
            // What the worksheet wants done with the result: put it in order and keep the first rows.
            const after = payload.workflow.filter((step): step is Extract<typeof step, { type: 'sort' }> => step.type === 'sort');
            // Without aggregation every source row is a mark, duplicates included, as in the other renderers.
            const step: IDataQueryWorkflowStep = query.op === 'raw'
                ? { type: 'view', query: [{ op: 'raw', fields: query.fields }] }
                : !aggregated && query.measures.length === 0
                ? { type: 'view', query: [{ op: 'raw', fields: query.groupBy }] }
                : { type: 'view', query: [{ op: 'aggregate', groupBy: query.groupBy, measures: query.measures }] };
            return computation({ workflow: [...steps, step, ...after], limit: payload.limit });
        };
    }, [before, aggregated, computation]);

    // Exports are of the whole sheet, not only the part scrolled into view. The CSV holds the query
    // result the marks are drawn from, with the values as stored.
    const sheet = useRef<WorksheetHandle>(null);
    useImperativeHandle(handle, () => {
        const ready = () => { if (!sheet.current) throw new Error('The chart is not drawn yet.'); return sheet.current; };
        return {
            exportSVG: async () => ready().exportSVG(),
            exportPNG: async () => ready().exportPNG(),
            exportCSV: () => ready().exportRecords().map(tableToCSV).join('\n\n'),
            size: () => ready().size(),
        };
    }, []);
    // Number and time formats from the chart settings, and the editor's language for everything they leave open.
    const { numberFormat, timeFormat, normalizedNumberFormat } = chart.layout.format ?? {};
    const written = useMemo(() => chartFormats({ numberFormat, timeFormat, normalizedNumberFormat }, locale), [numberFormat, timeFormat, normalizedNumberFormat, locale]);
    // The chart area shows nothing but the chart, so what was left out goes to the console.
    const dropped = [...adapted.notes, ...written.problems].join(' ');
    useEffect(() => { if (dropped) console.info(`[worksheet renderer] ${dropped}`); }, [dropped]);
    const host = useRef<HTMLDivElement>(null);
    const surface = useSurface(host, colors.dark ? darkTheme.paper : lightTheme.paper);
    // The canvas paints the surface color itself, or the chart's own background over it, so it blends in.
    // Text and rules follow how bright that is; marks follow the editor's theme, primary color and palette.
    const theme = useMemo<Theme>(() => {
        const paper = over(colors.background, surface);
        const base = isDark(paper) ? darkTheme : lightTheme;
        return {
            ...base, paper, mark: colors.primary,
            category: colors.category.length ? colors.category : base.category,
            ramp: colors.ramp.length ? colors.ramp : base.ramp,
            diverging: colors.diverging?.length ? colors.diverging : base.diverging,
            heatmap: colors.heatmap,
        };
    }, [surface, colors]);
    const [height, setHeight] = useState(520);
    useEffect(() => {
        const element = host.current!;
        const observer = new ResizeObserver(() => setHeight(Math.max(160, element.clientHeight - 16)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    // Nothing but the chart is drawn here. What the adapter left out is listed in adapted.notes
    // and covered by the adapter tests; the editor has no place for it next to the chart yet.
    return (
        <div ref={host} style={{ height: '100%', padding: 8, color: theme.text, overflow: 'hidden', boxSizing: 'border-box' }}>
            {adapted.spec ? <Worksheet ref={sheet} spec={adapted.spec} computation={run} height={height} theme={theme} formats={written.formats} compact
                onError={(message) => { if (message) onUnsupported(message); }}
                // The worksheet's own words for where it stands, in the editor's.
                onStatusChange={(status) => onStatusChange?.(status === 'querying' ? 'computing' : status === 'drawing' ? 'rendering' : status)}
                // What identifies the mark: its dimension values, as stored. Measures are left out, as an aggregated value is not a filter on rows.
                onMarkClick={(selection, event) => onMarkClick?.(Object.fromEntries(selection.predicates.map((p) => [p.field, p.value])), event)}
            /> : null}
        </div>
    );
}

// A chart is drawn here only when it maps to a worksheet and that worksheet compiles. Anything else,
// such as a table, a map or bars between two measures, never reaches this component: the editor
// keeps it on its own renderers instead of showing an error.
function canDraw(chart: IChart): boolean {
    const { spec } = chartToWorksheet(chart);
    if (!spec) return false;
    try { compileWorksheet(spec); return true; } catch { return false; }
}
registerNativeRenderer({ component: NativeWorksheet, canDraw });
