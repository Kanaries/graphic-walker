import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import { Worksheet, compileWorksheet, darkTheme, lightTheme, tableToCSV, type Computation, type Theme, type WorksheetHandle } from '@kanaries/worksheet-renderer';
import type { IChart } from '../../interfaces';
import type { NativeRendererProps, NativeUnsupported } from '../nativeTypes';
import { toWorkflow } from '../../utils/workflow';
import { chartToWorksheet } from './adapter';
import { composeWorkflow, drawnAtGrain, splitWorkflow, type Around } from './having';
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
function NativeWorksheet({ chart, fields, computation, colors, locale, fill, onError, handle, onStatusChange, onMarkClick }: NativeRendererProps) {
    const adapted = useMemo(() => chartToWorksheet(chart), [chart]);
    // In the fixed and full layout modes the whole sheet is scaled to the box the editor gives it. In the auto
    // mode only the value axes take up the room of the chart area, and a sheet that is too large scrolls.
    const spec = useMemo(() => adapted.spec && (fill ? { ...adapted.spec, fit: 'both' as const } : { ...adapted.spec, stretch: 'both' as const }), [adapted.spec, fill]);
    const aggregated = chart.config.defaultAggregated;
    // Everything the editor would run before its own view step: row filters, computed fields, filters on
    // those. The aggregate expressions as it would send them. And what it would run after: filters on
    // aggregated values, which go into the worksheet's queries.
    const around = useMemo(
        () => JSON.stringify(splitWorkflow(toWorkflow(chart.encodings.filters, fields, adapted.viewDimensions, adapted.viewMeasures, aggregated, 'none', chart.config.folds, undefined, chart.config.timezoneDisplayOffset))),
        [chart, fields, adapted, aggregated]
    );
    // `around` is compared as text so that an unrelated store update does not restart the queries.
    // Every query goes to the computation the host gave the editor, expressions included. Nothing is worked out here.
    const run = useMemo<Computation>(() => {
        const parsed: Around = JSON.parse(around);
        return async (payload) => {
            const workflow = composeWorkflow(parsed, aggregated, payload);
            return workflow.length ? computation({ workflow, limit: payload.limit }) : [];
        };
    }, [around, aggregated, computation]);

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
        const dark = isDark(paper);
        const base = dark ? darkTheme : lightTheme;
        // The theme's text and rule colors are made for the editor's own surface. On a background the user
        // set that is the other way round, light on dark or dark on light, they would not read, and the standard ones stay.
        const fits = dark === colors.dark;
        return {
            ...base, paper, mark: colors.primary,
            category: colors.category.length ? colors.category : base.category,
            ramp: colors.ramp.length ? colors.ramp : base.ramp,
            diverging: colors.diverging?.length ? colors.diverging : base.diverging,
            heatmap: colors.heatmap,
            ...(fits && colors.text ? { text: colors.text } : {}),
            ...(fits && colors.muted ? { muted: colors.muted } : {}),
            ...(fits && colors.line ? { line: colors.line } : {}),
            ...(fits && colors.grid ? { grid: colors.grid } : {}),
            ...colors.style,
        };
    }, [surface, colors]);
    const [height, setHeight] = useState(520);
    useEffect(() => {
        const element = host.current!;
        // A box the viewer sized is taken as it is; otherwise the sheet keeps a height worth drawing in.
        const observer = new ResizeObserver(() => setHeight(Math.max(fill ? 60 : 160, element.clientHeight - 16)));
        observer.observe(element);
        return () => observer.disconnect();
    }, [fill]);
    // Nothing but the chart is drawn here. What the adapter left out is listed in adapted.notes
    // and covered by the adapter tests; the editor has no place for it next to the chart yet.
    return (
        <div ref={host} style={{ height: '100%', padding: 8, color: theme.text, overflow: 'hidden', boxSizing: 'border-box' }}>
            {spec ? <Worksheet ref={sheet} spec={spec} computation={run} height={height} theme={theme} formats={written.formats} compact zoomable={chart.layout.interactiveScale}
                onError={(message) => { if (message) onError(message); }}
                // The worksheet's own words for where it stands, in the editor's.
                onStatusChange={(status) => onStatusChange?.(status === 'querying' ? 'computing' : status === 'drawing' ? 'rendering' : status)}
                // What identifies the mark: its dimension values, as stored. Measures are left out, as an aggregated value is not a filter on rows.
                onMarkClick={(selection, event) => onMarkClick?.(Object.fromEntries(selection.predicates.map((p) => [p.field, p.value])), event)}
            /> : null}
        </div>
    );
}

// Says why a chart cannot be drawn here, before anything is mounted or queried: it does not map to a
// worksheet, or the worksheet does not compile. The editor shows the reason in the chart area.
function check(chart: IChart): NativeUnsupported | undefined {
    const { spec, error, empty, viewDimensions, viewMeasures } = chartToWorksheet(chart);
    if (!spec) return { reason: error ?? 'The chart does not map to a worksheet.', empty };
    try {
        const plan = compileWorksheet(spec);
        // A filter on an aggregated value holds at the grain of the editor's one query. A sheet that draws
        // from another grain would show marks the filter should have removed.
        const fields = [...chart.encodings.dimensions, ...chart.encodings.measures];
        const { having } = splitWorkflow(toWorkflow(chart.encodings.filters, fields, viewDimensions, viewMeasures, chart.config.defaultAggregated, 'none', chart.config.folds));
        if (having && !drawnAtGrain(plan, having.groupBy)) {
            const names = chart.encodings.filters.filter((f) => f.enableAgg && f.aggName && f.rule).map((f) => f.name);
            return { reason: `The filter on an aggregated value (${names.join(', ')}) applies to groups of rows, and this chart is not drawn from those groups.` };
        }
    } catch (error) {
        return { reason: error instanceof Error ? error.message : String(error) };
    }
}
export const worksheetRenderer = { component: NativeWorksheet, check };
