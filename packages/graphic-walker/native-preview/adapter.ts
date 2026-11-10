import type { Aggregate, AxisExpr, FieldInstance, ScaleOptions, WorksheetSpec } from '@kanaries/worksheet-renderer';
import { MEA_KEY_ID, MEA_VAL_ID } from '../src/constants';
import type { IChart, IViewField } from '../src/interfaces';
import { viewEncodingKeys } from '../src/models/visSpec';

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
    bar: 'bar', line: 'line', area: 'area', trail: 'line', point: 'point', circle: 'circle', tick: 'tick', rect: 'rect', text: 'text',
    arc: 'arc', boxplot: 'boxplot',
};
const isMeasure = (f: IViewField) => f.analyticType === 'measure';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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
        // A date field as stored. Its values are shifted to the display time zone by the same rule the
        // editor's other renderers use: a timestamp by the display offset alone; text also by the offset
        // the field was recorded in, less the machine's own zone where the text is read in that zone.
        const stored = f.semanticType === 'temporal' && !f.computed;
        const local = new Date().getTimezoneOffset() * 60000;
        const display = (config.timezoneDisplayOffset ?? new Date().getTimezoneOffset()) * -60000;
        const recorded = f.offset === undefined ? local : f.offset * 60000;
        const time = drilled ? { scale: 'time' as const, timeUnit: f.timeUnit, timeOffset: display }
            : stored ? { scale: 'time' as const, timeOffset: { epoch: display, date: display + recorded, dateTime: display + recorded - local } } : undefined;
        // A dimension becomes an axis only where it ends a shelf that has no measure.
        if (position === 'terminal' && !headersOnly && (f.semanticType === 'quantitative' || time)) {
            return (instances[id] = { id, field: f.fid, label: f.name, display: 'continuous', scale: time ? 'time' : 'linear', zero: false, ...(time ? { timeOffset: time.timeOffset } : {}) });
        }
        // As a header a stored date is written as a date, a drilled one as its period.
        return (instances[id] = { id, field: f.fid, label: f.name, display: 'discrete', ...time });
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
    if (geom === 'trail') notes.push('Trail is drawn as a line of one width.');

    // A shelf the editor hides for this mark type may still hold a field from an earlier mark type.
    // Such a field is not part of the chart, as in the editor's own renderers.
    const shown = new Set<string>(viewEncodingKeys(geom));
    let text: string | undefined;
    // On a text mark the text field is what is written; on other marks it labels them.
    if (encodings.text[0] && (mark === 'text' || shown.has('text'))) {
        if (mark === 'boxplot') notes.push('Labels are not drawn on box plots.');
        else {
            const made = instance('text', encodings.text[0], 'encoding');
            if (typeof made === 'string') return result({ error: made });
            text = made.id;
        }
    }
    const channels: { size?: string; opacity?: string; shape?: string } = {};
    const unsized = mark === 'area' || mark === 'arc' || mark === 'boxplot';
    for (const channel of ['size', 'opacity', 'shape'] as const) {
        const f = encodings[channel][0];
        if (!f || !shown.has(channel)) continue;
        if (channel === 'size' && unsized) notes.push(`Size is not drawn on ${mark === 'boxplot' ? 'box plot' : mark} marks.`);
        else if (channel === 'opacity' && mark === 'boxplot') notes.push('Opacity is not drawn on box plots.');
        else if (channel === 'shape' && mark !== 'point' && mark !== 'circle') notes.push(`Shape is not drawn on ${mark} marks.`);
        else if (channel === 'shape' && isMeasure(f)) notes.push(`${f.name} on Shape is ignored: only a dimension picks symbols.`);
        else {
            const made = instance(channel, f, 'encoding');
            if (typeof made === 'string') return result({ error: made });
            channels[channel] = made.id;
        }
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

    if (shown.has('radius') && encodings.radius.length) notes.push('Not drawn yet: radius.');
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
    // Settings the editor offers that this renderer does not read yet. Every one of them is listed in
    // the gap table of the plan document; a setting that starts to work is removed here and there.
    // Scale settings: the axes of each shelf, and the color, size and opacity channels. The editor's
    // 'pow' has no exponent setting and is a linear scale, as in its other renderers.
    const scales: NonNullable<WorksheetSpec['scales']> = {};
    const continuous = (id?: string) => Boolean(id && instances[id].display === 'continuous');
    for (const [from, to, id] of [['row', 'rows', undefined], ['column', 'columns', undefined], ['color', 'color', color], ['size', 'size', channels.size], ['opacity', 'opacity', channels.opacity]] as const) {
        const set = layout.scale?.[from];
        const channel = to !== 'rows' && to !== 'columns';
        const options: ScaleOptions = {};
        if (set?.type && set.type !== 'linear' && set.type !== 'pow') options.type = set.type;
        if (isNumber(set?.domainMin)) options.min = set!.domainMin;
        if (isNumber(set?.domainMax)) options.max = set!.domainMax;
        if (channel && to !== 'color' && isNumber(set?.rangeMin) && isNumber(set?.rangeMax)) options.range = [set!.rangeMin!, set!.rangeMax!];
        if (channel && Object.keys(options).length && id && !continuous(id)) {
            // A dimension has members, not a range; only what the levels turn into applies to it.
            if (options.type || options.min !== undefined || options.max !== undefined) notes.push(`The ${to} scale type and domain apply to a measure, not to a dimension.`);
            delete options.type; delete options.min; delete options.max;
        }
        // Independent: every pane ranges over its own values. A dimension keeps one look per member everywhere.
        if (channel && layout.resolve?.[to]) {
            if (continuous(id)) options.independent = true;
            else if (id) notes.push(`An independent ${to} scale applies to a measure; each member of a dimension keeps its ${to} in every pane.`);
        }
        if (Object.keys(options).length) scales[to] = options;
    }
    if (layout.resolve?.shape && channels.shape) notes.push('An independent shape scale is not applied; each member keeps its symbol in every pane.');
    for (const unused of ['theta', 'radius'] as const) if (layout.scale?.[unused] && Object.keys(layout.scale[unused]!).length) notes.push(`The ${unused} scale is not applied.`);
    if (layout.useSvg) notes.push('The sheet is always drawn on a canvas.');

    const spec: WorksheetSpec = {
        kind: 'worksheet', specVersion: 2, instances,
        rows: rows.expr, columns: columns.expr,
        mark, color, detail, text, angle, ...channels,
        // 'zero' is the editor's older name for a plain stack. Only bars and areas pile up.
        stack: layout.stack === 'none' ? false : layout.stack === 'normalize' || layout.stack === 'center' ? layout.stack : true,
        order,
        ...(Object.keys(scales).length ? { scales } : {}),
        // The editor's limit cuts the query result, after ordering it by the sort measure when a sort is on.
        limit: config.limit > 0 ? { rows: config.limit, ...ranked } : undefined,
        // The editor's switches are per direction: x is the axes along the columns, y the axes along the rows.
        scaleScope: { columns: layout.resolve?.x ? 'independent' : 'shared', rows: layout.resolve?.y ? 'independent' : 'shared' },
    };
    return result({ spec });
}

function unique(fields: IViewField[]): IViewField[] {
    return [...new Map(fields.map((f) => [`${f.fid}|${f.aggName ?? ''}`, f])).values()];
}
