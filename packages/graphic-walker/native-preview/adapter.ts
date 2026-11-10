import type { Aggregate, AxisExpr, FieldInstance, WorksheetSpec } from '@kanaries/worksheet-renderer';
import { MEA_KEY_ID, MEA_VAL_ID } from '../src/constants';
import type { IChart, IViewField } from '../src/interfaces';

export interface AdaptedChart {
    /** Absent when the worksheet renderer cannot draw the chart; `error` says why. */
    spec?: WorksheetSpec;
    error?: string;
    /** Parts of the chart that were left out or approximated. */
    notes: string[];
    /** The fields the worksheet queries, split the way the editor's workflow builder takes them. */
    viewDimensions: IViewField[];
    viewMeasures: IViewField[];
}

const aggregates = new Set<string>(['sum', 'mean', 'median', 'min', 'max', 'count', 'distinctCount', 'variance', 'stdev']);
const marks: Record<string, WorksheetSpec['mark'] | undefined> = {
    bar: 'bar', line: 'line', area: 'line', trail: 'line', point: 'point', circle: 'circle', tick: 'tick', rect: 'rect', text: 'text',
    arc: 'arc', boxplot: 'boxplot',
};
const isMeasure = (f: IViewField) => f.analyticType === 'measure';

/**
 * Maps a stored chart to the worksheet renderer's input. The chart stays the source of
 * truth; nothing here is saved.
 *
 * Shelf rule, per axis, after the editor has put dimensions before measures:
 * - with measures, every dimension is a header level and each measure is a value axis;
 * - without measures, the last dimension is the position inside a pane: one slot per
 *   member when nominal or ordinal, a linear axis when quantitative, a time axis when temporal.
 *
 * Two mark types read the shelves differently. A pie has no axes: every dimension on rows and
 * columns is a header, one pie is drawn per cell, and the measure comes from the angle shelf.
 * A box plot has one axis, its measure, so its dimensions are all headers too.
 */
export function chartToWorksheet(chart: IChart): AdaptedChart {
    const { encodings, config, layout } = chart;
    const notes: string[] = [];
    const used: IViewField[] = [];
    const instances: Record<string, FieldInstance> = {};
    const result = (extra: Partial<AdaptedChart>): AdaptedChart => ({
        notes,
        viewDimensions: unique(used.filter((f) => !isMeasure(f))),
        viewMeasures: unique(used.filter(isMeasure)),
        ...extra,
    });
    if (config.coordSystem === 'geographic') return result({ error: 'Maps are not drawn by the worksheet renderer.' });
    const geom = config.geoms[0] ?? 'auto';
    const headersOnly = geom === 'arc' || geom === 'boxplot';
    const all = [...encodings.rows, ...encodings.columns, ...encodings.color, ...encodings.details, ...encodings.text, ...(geom === 'arc' ? encodings.theta : [])];
    if (all.some((f) => f.fid === MEA_KEY_ID || f.fid === MEA_VAL_ID)) {
        return result({ error: 'Measure names and Measure values are not supported yet. Put the measures on the shelf one by one.' });
    }
    const aggregated = config.defaultAggregated;
    // A box shows where the records lie, so its axis does not reach back to zero.
    const zero = geom !== 'boxplot' && layout.zeroScale !== false;

    function instance(id: string, f: IViewField, position: 'header' | 'terminal' | 'encoding'): FieldInstance | string {
        used.push(f);
        if (isMeasure(f)) {
            if (!aggregated) return (instances[id] = { id, field: f.fid, label: f.name, display: 'continuous', zero });
            const aggregate = f.aggName ?? 'sum';
            if (!aggregates.has(aggregate)) return `${f.name} uses the aggregation "${aggregate}", which is not supported yet.`;
            return (instances[id] = { id, field: f.fid, label: `${aggregate}(${f.name})`, display: 'continuous', aggregate: aggregate as Aggregate, zero });
        }
        // A date drilled to a unit, such as the year of a date, holds the start of each period as a
        // timestamp. It is shifted to the display time zone, as the editor's other renderers do, and
        // its members are named after the period.
        const drilled = f.semanticType === 'temporal' && f.computed && f.timeUnit;
        const period = drilled ? { scale: 'time' as const, timeUnit: f.timeUnit, timeOffset: (config.timezoneDisplayOffset ?? new Date().getTimezoneOffset()) * -60000 } : {};
        // A dimension becomes an axis only where it ends a shelf that has no measure.
        const temporal = f.semanticType === 'temporal' && (!f.computed || drilled);
        if (position === 'terminal' && !headersOnly && (f.semanticType === 'quantitative' || temporal)) {
            return (instances[id] = { id, field: f.fid, label: f.name, display: 'continuous', scale: temporal ? 'time' : 'linear', zero: false, ...(drilled ? { timeOffset: period.timeOffset } : {}) });
        }
        return (instances[id] = { id, field: f.fid, label: f.name, display: 'discrete', ...period });
    }

    interface Shelf { expr: AxisExpr; measures: number; terminal?: FieldInstance; values: FieldInstance[]; sorted: { id: string; direction: 'ascending' | 'descending' }[] }
    function shelf(name: string, fields: IViewField[]): Shelf | string {
        const dimensions = fields.filter((f) => !isMeasure(f));
        const measures = geom === 'arc' ? [] : fields.filter(isMeasure);
        if (geom === 'arc' && fields.some(isMeasure)) notes.push(`Measures on the ${name} shelf are not part of a pie. The angle shelf sizes the slices.`);
        const items: AxisExpr[] = [];
        let terminal: FieldInstance | undefined;
        const sorted: Shelf['sorted'] = [];
        for (const [index, f] of dimensions.entries()) {
            const last = index === dimensions.length - 1 && measures.length === 0;
            const made = instance(`${name}${index}`, f, last ? 'terminal' : 'header');
            if (typeof made === 'string') return made;
            if (last) terminal = made;
            // An axis has no members to reorder; only headers do.
            if ((f.sort === 'ascending' || f.sort === 'descending') && made.display === 'discrete') sorted.push({ id: made.id, direction: f.sort });
            items.push({ kind: 'field', instanceId: made.id });
        }
        const values: FieldInstance[] = [];
        for (const [index, f] of measures.entries()) {
            const made = instance(`${name}m${index}`, f, 'terminal');
            if (typeof made === 'string') return made;
            values.push(made);
        }
        const axes: AxisExpr[] = values.map((made) => ({ kind: 'field', instanceId: made.id }));
        if (axes.length) items.push(axes.length === 1 ? axes[0] : { kind: 'concat', items: axes });
        return { expr: items.length ? { kind: 'nest', items } : { kind: 'empty' }, measures: measures.length, terminal, values, sorted };
    }

    const rows = shelf('row', encodings.rows);
    if (typeof rows === 'string') return result({ error: rows });
    const columns = shelf('column', encodings.columns);
    if (typeof columns === 'string') return result({ error: columns });

    let color: string | undefined;
    if (geom === 'boxplot' && encodings.color[0] && isMeasure(encodings.color[0])) {
        notes.push(`${encodings.color[0].name} on Color is ignored: a box plot takes a dimension there.`);
    } else if (encodings.color[0]) {
        const made = instance('color', encodings.color[0], 'encoding');
        if (typeof made === 'string') return result({ error: made });
        color = made.id;
    }
    const detail: string[] = [];
    for (const [index, f] of encodings.details.entries()) {
        if (isMeasure(f)) { notes.push(`${f.name} on Details is ignored: only dimensions split marks.`); continue; }
        const made = instance(`detail${index}`, f, 'encoding');
        if (typeof made !== 'string') detail.push(made.id);
    }

    let mark = marks[geom];
    if (geom === 'auto') {
        // The editor's automatic choice: two value axes make a scatter; one makes a line along a date,
        // otherwise bars, or ticks when every record is drawn; none makes a table of text or colored cells.
        if (rows.measures && columns.measures) mark = 'point';
        else if (rows.measures || columns.measures) mark = (rows.measures ? columns : rows).terminal?.scale === 'time' ? 'line' : aggregated ? 'bar' : 'tick';
        else mark = encodings.text[0] ? 'text' : color && instances[color].display === 'continuous' ? 'rect' : 'point';
    }
    if (!mark) return result({ error: `The mark type "${geom}" is not drawn by the worksheet renderer yet.` });
    if (geom === 'area') notes.push('Area is drawn as a line.');
    if (geom === 'trail') notes.push('Trail is drawn as a line of one width.');

    let text: string | undefined;
    if (mark === 'text' && encodings.text[0]) {
        const made = instance('text', encodings.text[0], 'encoding');
        if (typeof made === 'string') return result({ error: made });
        text = made.id;
    }

    let angle: string | undefined;
    if (mark === 'arc' && encodings.theta[0]) {
        if (!isMeasure(encodings.theta[0])) return result({ error: `${encodings.theta[0].name} on Angle is a dimension. The worksheet renderer sizes slices by a measure.` });
        const made = instance('angle', encodings.theta[0], 'encoding');
        if (typeof made === 'string') return result({ error: made });
        angle = made.id;
    }

    // An empty chart stays with the editor's own renderer, which shows nothing for it.
    const empty = rows.expr.kind === 'empty' && columns.expr.kind === 'empty';
    if (empty && !(mark === 'arc' && (angle || color))) return result({ error: 'There is nothing on rows or columns to draw yet.' });

    const ignored = (['size', 'shape', 'opacity', 'theta', 'radius'] as const).filter((channel) => encodings[channel].length > 0 && !(channel === 'theta' && mark === 'arc'));
    if (ignored.length) notes.push(`Not drawn yet: ${ignored.join(', ')}.`);
    if (mark !== 'text' && encodings.text.length) notes.push('Text labels on marks are not drawn yet.');
    if (layout.stack === 'normalize' || layout.stack === 'center') notes.push(`Stack mode "${layout.stack}" is drawn as a plain stack.`);
    // The editor's sort orders a dimension by the measure across from it, the first one where there are
    // several, as Tableau's toolbar sort takes the leftmost. Each parent header is ordered on its own.
    // A measure that is drawn per record still orders the members by one number per member: its sum,
    // or its median under a box plot, which is the line the box shows.
    const order: NonNullable<WorksheetSpec['order']> = {};
    // The limit orders the records themselves, so under it a measure drawn per record stays as it is.
    let ranked: { by: string; direction: 'ascending' | 'descending' } | undefined;
    for (const [own, other] of [[rows, columns], [columns, rows]] as const) {
        if (!own.sorted.length) continue;
        const candidates = [other.values[0], own.values[0], angle ? instances[angle] : undefined, text ? instances[text] : undefined, color && instances[color].display === 'continuous' ? instances[color] : undefined];
        let by = candidates.find((f): f is FieldInstance => Boolean(f));
        if (!by) { notes.push('There is no measure to sort by; members are in value order.'); continue; }
        ranked ??= { by: by.id, direction: own.sorted[own.sorted.length - 1].direction };
        if (!by.aggregate) by = instances.order = { id: 'order', field: by.field, label: by.label, display: 'continuous', aggregate: geom === 'boxplot' ? 'median' : 'sum' };
        for (const { id, direction } of own.sorted) order[id] = { by: by.id, direction };
    }
    if (encodings.filters.some((f) => f.enableAgg)) notes.push('Filters on aggregated values are not applied.');
    // Settings the editor offers that this renderer does not read yet. Every one of them is listed in
    // the gap table of the plan document; a setting that starts to work is removed here and there.
    if (layout.format?.numberFormat || layout.format?.timeFormat || layout.format?.normalizedNumberFormat) notes.push('Number and time formats are not applied.');
    if (layout.scale && Object.values(layout.scale).some((scale) => scale && Object.keys(scale).length > 0)) notes.push('Scale settings are not applied.');
    if (layout.resolve?.color || layout.resolve?.opacity || layout.resolve?.shape || layout.resolve?.size) notes.push('Independent legends are not drawn.');
    if (layout.interactiveScale) notes.push('Axes cannot be zoomed or panned.');
    if (layout.size.mode !== 'auto') notes.push('The chart size setting is not applied; the sheet takes the space it needs.');
    if (layout.useSvg) notes.push('The sheet is always drawn on a canvas.');

    const spec: WorksheetSpec = {
        kind: 'worksheet', specVersion: 2, instances,
        rows: rows.expr, columns: columns.expr,
        mark, color, detail, text, angle,
        stack: layout.stack !== 'none',
        order,
        // The editor's limit cuts the query result, after ordering it by the sort measure when a sort is on.
        limit: config.limit > 0 ? { rows: config.limit, ...ranked } : undefined,
        scaleScope: layout.resolve?.x || layout.resolve?.y ? 'independent' : 'shared',
    };
    return result({ spec });
}

function unique(fields: IViewField[]): IViewField[] {
    return [...new Map(fields.map((f) => [`${f.fid}|${f.aggName ?? ''}`, f])).values()];
}
