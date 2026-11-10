import type { IChart } from '../interfaces';
import { CLASSIC_CROSS_LIMIT } from '../lib/gog';
import type { NativeRegistry } from './nativeRegistry';

/** A shelf that holds more dimensions than the chart's renderer shows. */
export interface ShelfOverflow {
    shelf: 'rows' | 'columns';
    fields: string[];
}

/**
 * What the chart area says in place of a chart it does not draw.
 * - loading: the worksheet renderer is being fetched.
 * - unavailable: the chart asks for the worksheet renderer and this environment has none.
 * - unsupported: the worksheet renderer cannot draw the chart; `reason` says what is in the way.
 * - failed: a query or the drawing went wrong; `reason` is the error.
 * - levels: the chart has more dimensions on a shelf than its renderer shows.
 */
export type ChartNoticeContent =
    | { state: 'loading' | 'unavailable' }
    | { state: 'unsupported' | 'failed'; reason: string }
    | { state: 'levels'; renderer: 'vega-lite' | 'observable-plot'; shelves: ShelfOverflow[] };

/**
 * Where a chart is drawn.
 * - dedicated: maps and tables have components of their own, whichever renderer draws ordinary charts.
 * - classic: Vega-Lite or Observable Plot, as the chart says.
 * - native: the worksheet renderer.
 * - blank: the worksheet renderer, with nothing on the shelves to draw yet.
 * - notice: nowhere. The chart area says why.
 */
export type ChartRoute = { to: 'dedicated'; kind: 'table' | 'map' } | { to: 'classic' } | { to: 'native' } | { to: 'blank' } | { to: 'notice'; notice: ChartNoticeContent };

/**
 * Picks the component that draws a chart. The kind of chart comes first: a table or a map goes to
 * its own component and the chart's renderer setting is not looked at. An ordinary chart goes to
 * the renderer it names, Vega-Lite where it names none. A renderer that cannot draw the chart is
 * never replaced by another one; the chart area says what is wrong and the chart stays as saved.
 */
export function routeChart(chart: IChart, registry: NativeRegistry): ChartRoute {
    if (chart.config.geoms[0] === 'table') return { to: 'dedicated', kind: 'table' };
    if (chart.config.coordSystem === 'geographic') return { to: 'dedicated', kind: 'map' };
    const renderer = chart.layout.renderer ?? 'vega-lite';
    if (renderer === 'native') {
        if (!registry.renderer) return { to: 'notice', notice: { state: registry.loading ? 'loading' : 'unavailable' } };
        const cannot = registry.renderer.check(chart);
        if (!cannot) return { to: 'native' };
        return cannot.empty ? { to: 'blank' } : { to: 'notice', notice: { state: 'unsupported', reason: cannot.reason } };
    }
    // The editor keeps these shelves within the limit while one of these renderers is chosen. A chart
    // built under the worksheet renderer can hold more, and would be drawn here with levels left out.
    const shelves = (['rows', 'columns'] as const)
        .map((shelf) => ({ shelf, fields: chart.encodings[shelf].filter((f) => f.analyticType === 'dimension').map((f) => f.name) }))
        .filter((held) => held.fields.length > CLASSIC_CROSS_LIMIT);
    if (shelves.length) return { to: 'notice', notice: { state: 'levels', renderer, shelves } };
    return { to: 'classic' };
}
