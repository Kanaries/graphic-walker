import { compareValue, pathKey, typed, valueKey } from './keys';
import { resolveFormats, type Format, type Formats } from './formats';
import { buildAxis, leafFloors, leafSizes, leastSize, metrics, resizeAxis, scaleAxis, setFont, stretchAxis, tickScale, textWidth, type LeafDraft, type MemberCompare } from './layout';
import { logTicks, position } from './warp';
import { memberLabel, positionValue, timeScale } from './time';
import { branchFields, valueAxis } from './compiler';
import { legendTitleHeight, levelOf, type ChannelScale, type LegendBlock } from './channels';
import { resultKey, type AxisBranch, type AxisLayout, type AxisLeaf, type ColorScale, type Frame, type Pane, type PaneMark, type Plan, type Row, type ScaleOptions, type Value, type WorksheetModel, type WorksheetSpec } from './types';

function draft(axis: 'row' | 'column', branch: AxisBranch, record: Row): LeafDraft {
    const facets = branch.facets.map(f => ({ instanceId: f.id, value: record[f.field] as Value }));
    const groupId = JSON.stringify([branch.id, pathKey(axis, facets)]);
    if (branch.position?.display !== 'discrete') return { id: groupId, groupId, branch, path: facets, kind: branch.position ? 'continuous' : 'single' };
    const path = [...facets, { instanceId: branch.position.id, value: record[branch.position.field] as Value }];
    return { id: JSON.stringify([branch.id, pathKey(axis, path)]), groupId, branch, path, kind: 'band' };
}

/** How marks that share a position pile up. Only bars and areas do. */
export function stackMode(plan: Plan): false | 'stack' | 'normalize' | 'center' {
    const { mark, stack } = plan.spec;
    if ((mark !== 'bar' && mark !== 'area') || stack === false) return false;
    return stack === 'normalize' || stack === 'center' ? stack : 'stack';
}

interface CellItem { record: Row; row: string; column: string }
/** Value at share p of an ascending list, interpolated between neighbours. */
const quantile = (sorted: number[], p: number) => {
    const at = (sorted.length - 1) * p, i = Math.floor(at);
    return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (at - i);
};

// Orders the records of one pane by series and gives each its interval on the measure axis.
// Stacking accumulates per member, positive and negative values apart.
// slots places the members of the color field side by side inside a member step; box plots use it.
function paneMarks(items: CellItem[], rowBranch: AxisBranch, columnBranch: AxisBranch, plan: Plan, rowIndex: Map<string, number>, columnIndex: Map<string, number>, slots?: Map<string, number>): PaneMark[] {
    const x = columnBranch.position;
    const y = rowBranch.position;
    const axis = valueAxis(x, y);
    const measure = axis === 'x' ? x : axis === 'y' ? y : undefined;
    // Bars placed along a continuous field stack per position, not per pane.
    const other = axis === 'x' ? y : x;
    const along = other?.display === 'continuous' ? other : undefined;
    // Only dimensions split a pane into series. A measure on color tints the marks without dividing them.
    const series = [plan.spec.color, ...(plan.spec.detail ?? []), plan.spec.size, plan.spec.opacity, plan.spec.shape, plan.spec.text]
        .filter((id): id is string => Boolean(id)).map(id => plan.spec.instances[id]).filter(f => f.display === 'discrete');
    const sorted = [...items].sort((a, b) => {
        for (const f of series) {
            const cmp = compareValue(a.record[f.field], b.record[f.field]);
            if (cmp) return cmp;
        }
        return 0;
    });
    const place = (item: CellItem) => ({ record: item.record, row: rowIndex.get(item.row)!, column: columnIndex.get(item.column)! });
    if (plan.spec.mark === 'arc') {
        // One pie per cell. A slice is its share of the cell's total; a record without a positive value gets none.
        const angle = plan.spec.angle ? plan.spec.instances[plan.spec.angle] : undefined;
        const share = (record: Row) => { const value = angle ? positionValue(angle, record) : 1; return value > 0 ? value : NaN; };
        const cell = (item: CellItem) => `${item.row}\n${item.column}`;
        const sums = new Map<string, number>();
        for (const item of sorted) { const value = share(item.record); if (value > 0) sums.set(cell(item), (sums.get(cell(item)) ?? 0) + value); }
        const turned = new Map<string, number>();
        return sorted.map(item => {
            const value = share(item.record), key = cell(item);
            if (!(value > 0)) return { ...place(item), start: NaN, end: NaN };
            const start = turned.get(key) ?? 0, end = start + value / sums.get(key)!;
            turned.set(key, end);
            return { ...place(item), start, end };
        });
    }
    if (plan.spec.mark === 'boxplot') {
        // One box per member and color. Detail fields only decide what one record is.
        const color = series.find(f => f.id === plan.spec.color);
        const kept = [...branchFields(rowBranch), ...branchFields(columnBranch), ...(color ? [color] : [])].filter(f => f.display === 'discrete');
        const boxes = new Map<string, CellItem[]>();
        for (const item of sorted) {
            const key = JSON.stringify([item.row, item.column, color ? valueKey(item.record[color.field]) : '']);
            const box = boxes.get(key) ?? [];
            box.push(item);
            boxes.set(key, box);
        }
        const marks: PaneMark[] = [];
        for (const box of boxes.values()) {
            const values = box.map(item => positionValue(measure!, item.record));
            const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
            if (!finite.length) continue;
            const q1 = quantile(finite, .25), median = quantile(finite, .5), q3 = quantile(finite, .75), reach = 1.5 * (q3 - q1);
            const low = finite.find(v => v >= q1 - reach)!, high = finite.filter(v => v <= q3 + reach).pop()!;
            const slot: [number, number] | undefined = color && slots ? [slots.get(valueKey(box[0].record[color.field])) ?? 0, slots.size] : undefined;
            const record = { ...Object.fromEntries(kept.map(f => [f.field, box[0].record[f.field]])), [resultKey(measure!)]: median };
            marks.push({ ...place(box[0]), record, start: low, end: high, box: { low, q1, median, q3, high, count: finite.length }, slot });
            box.forEach((item, index) => {
                if (values[index] < low || values[index] > high) marks.push({ ...place(item), start: values[index], end: values[index], outlier: true, slot });
            });
        }
        return marks;
    }
    const mode = stackMode(plan);
    // Marks pile up where they share a member, or a position along a continuous field.
    const pile = (item: CellItem) => (axis === 'x' ? item.row : item.column) + (along ? `|${positionValue(along, item.record)}` : '');
    const valueOf = (item: CellItem) => measure ? positionValue(measure, item.record) : 0;
    if (mode === 'normalize' || mode === 'center') {
        // Both pile magnitudes in one direction, so a negative value takes room like a positive one.
        const sums = new Map<string, number>();
        for (const item of sorted) { const value = valueOf(item); if (Number.isFinite(value)) sums.set(pile(item), (sums.get(pile(item)) ?? 0) + Math.abs(value)); }
        const reached = new Map<string, number>();
        return sorted.map(item => {
            const value = valueOf(item), key = pile(item), sum = sums.get(key) ?? 0;
            // A pile that adds up to nothing has no shares to show.
            if (!Number.isFinite(value) || (mode === 'normalize' && !(sum > 0))) return { ...place(item), start: NaN, end: NaN };
            const size = mode === 'normalize' ? Math.abs(value) / sum : Math.abs(value);
            const start = reached.get(key) ?? (mode === 'center' ? -sum / 2 : 0);
            reached.set(key, start + size);
            return { ...place(item), start, end: start + size, ...(mode === 'normalize' ? { share: size } : {}) };
        });
    }
    const totals = new Map<string, [number, number]>();
    const stack = Boolean(mode);
    const marks = sorted.map(item => {
        const leaves = place(item);
        const value = valueOf(item);
        if (!Number.isFinite(value)) return { ...leaves, start: NaN, end: NaN };
        if (!stack) return { ...leaves, start: 0, end: value };
        const key = pile(item);
        const total = totals.get(key) ?? [0, 0];
        const sign = value >= 0 ? 0 : 1;
        const start = total[sign];
        total[sign] += value;
        totals.set(key, total);
        return { ...leaves, start, end: total[sign] };
    });
    // Bars that overlap are painted longest first, so a short one is not hidden behind a long one.
    if (!stack && plan.spec.mark === 'bar') marks.sort((a, b) => (Math.abs(b.end) || 0) - (Math.abs(a.end) || 0));
    return marks;
}

// Ranges come from the complete result, never from the visible window. A range is keyed
// by measure and by a scope along the axis itself, so every pane in one row or column
// shares it and the axis can be drawn once on the table edge.
// The ranges are read from the records once. What comes back places the ticks for the sizes the
// slots have at that moment, and is called again whenever the slots are resized.
function assignScales(layout: AxisLayout, axis: 'x' | 'y', panes: Pane[], plan: Plan, format: Format, zoom?: Zoom): () => void {
    const set = plan.spec.scaleScope;
    const scope = (typeof set === 'object' ? set[axis === 'x' ? 'columns' : 'rows'] : set) ?? 'shared';
    const keyOf = (leaf: AxisLeaf) => {
        const id = leaf.branch.position!.id;
        return scope === 'independent' ? leaf.id : scope === 'prefix' ? JSON.stringify([id, pathKey(layout.axis, leaf.path.slice(0, 1))]) : id;
    };
    const extents = new Map<string, [number, number]>();
    const positions = new Map<string, Set<number>>();
    // Bars and areas run from where their pile has reached to where they end, boxes from whisker to
    // whisker. Their axis covers those intervals, not the values of single records.
    const spans = plan.spec.mark === 'bar' || plan.spec.mark === 'area' || plan.spec.mark === 'boxplot';
    const bars = plan.spec.mark === 'bar';
    const shares = stackMode(plan) === 'normalize';
    const shared = new Set<string>();
    // The axis settings of this shelf. They do not apply to time axes.
    const options = plan.spec.scales?.[axis === 'x' ? 'columns' : 'rows'];
    for (const pane of panes) {
        const group = axis === 'x' ? pane.column : pane.row;
        const f = group.branch.position;
        if (!f || f.display !== 'continuous') continue;
        const key = keyOf(layout.leaves[group.start]);
        const time = f.scale === 'time';
        const log = !time && options?.type === 'log';
        // A value axis starts from zero. A date axis has no zero worth showing, and a log axis has no zero at all.
        const extent = extents.get(key) ?? (time || log || f.zero === false ? [Infinity, -Infinity] : [0, 0]);
        const carriesValue = valueAxis(pane.column.branch.position, pane.row.branch.position) === axis;
        const distinct = bars && !carriesValue ? positions.get(key) ?? new Set<number>() : undefined;
        for (const mark of pane.marks) {
            const raw = mark.record[resultKey(f)];
            const value = positionValue(f, mark.record);
            // A number that is not finite, such as the logarithm of zero, is a missing value and leaves no mark.
            // Anything that is not a number at all means the field is not continuous, which is the caller's mistake.
            if (raw != null && (time ? Number.isNaN(value) : typeof raw !== 'number')) {
                throw new Error(time ? `Time field ${f.label} returned a value that is not a date: ${String(raw)}`
                    : `Continuous field ${f.label} returned a value that is not a number: ${String(raw)}`);
            }
            if (Number.isFinite(value)) distinct?.add(value);
            for (const v of spans && carriesValue ? [mark.start, mark.end] : [value]) {
                if (Number.isFinite(v) && !(log && v <= 0)) { extent[0] = Math.min(extent[0], v); extent[1] = Math.max(extent[1], v); }
            }
        }
        extents.set(key, extent);
        if (shares && carriesValue) shared.add(key);
        if (distinct) positions.set(key, distinct);
    }
    return () => { for (const leaf of layout.leaves) {
        if (leaf.kind !== 'continuous') continue;
        const key = keyOf(leaf);
        const time = leaf.branch.position!.scale === 'time';
        let [min, max] = extents.get(key) ?? [0, 1];
        if (min > max) [min, max] = time ? [0, 86_400_000] : [0, 1];
        // Bars along this axis need half a step of room at both ends, or the outer ones are cut in half.
        const sorted = [...positions.get(key) ?? []].sort((a, b) => a - b);
        const step = sorted.length > 1 ? Math.min(...sorted.slice(1).map((v, i) => v - sorted[i])) : undefined;
        if (step) { min -= step / 2; max += step / 2; }
        const type = time ? undefined : options?.type;
        // Ends of the range set by hand win over the data.
        const fixed = !time && (options?.min !== undefined || options?.max !== undefined);
        if (!time && options?.min !== undefined) min = options.min;
        if (!time && options?.max !== undefined) max = options.max;
        if (type === 'log') {
            // Only positive values have a place. A range that reaches zero starts three powers of ten below its end.
            if (!(max > 0)) max = 1;
            if (!(min > 0) || min >= max) min = min === max && min > 0 ? min / 10 : max / 1000;
            if (min === max) max = min * 10;
        } else if (!time && min >= max && fixed) max = min + 1;
        const pixels = leaf.size - metrics.scalePadStart - metrics.scalePadEnd;
        // Every axis carries its labels: dates from the time scale, shares in percent, other numbers as ticks.
        const make = (gap: number, least = 2) => {
            const scale = time ? timeScale(min, max, pixels, gap, format) : tickScale(min, max, pixels, gap, least);
            if (type === 'log') scale.ticks = logTicks(min, max, Math.max(2, Math.floor(pixels / gap))) ?? scale.ticks;
            if (!time) scale.labels = scale.ticks.map(shared.has(key) ? format.share : format.tick);
            return scale;
        };
        const at = (scale: { domain: [number, number] }, tick: number) => position(scale.domain, tick, type) * pixels;
        let gap = axis === 'x' ? (time ? 62 : 46) : 30;
        // The range the data asks for, and in its place the one the viewer zoomed or panned to.
        const id = `${axis}|${key}`;
        const full = make(gap).domain;
        const zoomed = zoom?.[id];
        if (zoomed && zoomed[0] < zoomed[1] && zoomed.every(Number.isFinite)) [min, max] = zoomed;
        let scale = make(gap);
        // Labels along a horizontal axis must not run into each other. A format that writes long labels gets fewer ticks.
        for (let round = 0; axis === 'x' && round < 3 && scale.ticks.length > 1; round++) {
            const widest = Math.max(...scale.labels!.map(label => textWidth(label, 10)));
            // The two closest ticks decide; on an axis that is not linear they are not the first two.
            const spacing = Math.min(...scale.ticks.slice(1).map((tick, i) => at(scale, tick) - at(scale, scale.ticks[i])));
            if (widest + 10 <= spacing) break;
            // Where even two steps are too many, one step keeps a label at each end of the range.
            scale = make(gap = Math.max(gap * 1.5, widest + 14), 1);
        }
        // In a slot too narrow even for that, a label that would run into the one before it is left blank. Its tick stays.
        // The same goes for a vertical axis whose ticks crowd together, as near the start of a square root axis.
        if (scale.labels && (axis === 'x' || type)) {
            let free = -Infinity;
            scale.labels = scale.labels.map((label, i) => {
                const center = at(scale, scale.ticks[i]), half = axis === 'x' ? textWidth(label, 10) / 2 : 5;
                if (center - half < free) return '';
                free = center + half + (axis === 'x' ? 6 : 2);
                return label;
            });
        }
        leaf.scale = { ...scale, step, key: id, full, ...(type && type !== 'linear' ? { type } : {}), ...(fixed ? { fixed } : {}) };
    } };
}

// The range of a continuous channel: the extent of the data, with the ends set by hand in their place.
function continuousRange(extent: [number, number], options?: ScaleOptions): { domain?: [number, number]; type?: ScaleOptions['type']; fixed?: boolean } {
    const fixed = options?.min !== undefined || options?.max !== undefined;
    let [low, high] = extent[0] <= extent[1] ? extent : [NaN, NaN];
    if (options?.min !== undefined) low = options.min;
    if (options?.max !== undefined) high = options.max;
    const type = options?.type && options.type !== 'linear' ? options.type : undefined;
    // A log range needs a positive start.
    if (type === 'log' && !(low > 0) && high > 0) low = high / 1000;
    return { domain: Number.isFinite(low) && Number.isFinite(high) && low <= high ? [low, high] : undefined, ...(type ? { type } : {}), ...(fixed ? { fixed } : {}) };
}

// What explains each channel, in the order the strip shows it: color, size, opacity, shape.
function buildLegends(spec: WorksheetSpec, colors: Value[], colorScale: ColorScale | undefined, channels: WorksheetModel['channels'], format: Format): LegendBlock[] {
    const blocks: LegendBlock[] = [];
    const list = (channel: LegendBlock['channel'], title: string, entries: LegendBlock['entries'], step = 18) =>
        blocks.push({ channel, title, kind: 'list', entries, step, height: legendTitleHeight + entries.length * step + 6 });
    const color = spec.color ? spec.instances[spec.color] : undefined;
    // A channel whose range differs from pane to pane has no numbers to show, only which end is which.
    const ends = [format.words.low, format.words.high];
    if (color && colorScale) blocks.push({ channel: 'color', title: color.label, kind: 'ramp', step: 0, height: 64,
        entries: colorScale.domain.map((value, i) => ({ label: spec.scales?.color?.independent ? ends[i] : format.tick(value), level: i })) });
    else if (color) list('color', color.label, colors.map((value, i) => ({ label: memberLabel(color, value, format), level: i })));
    for (const channel of ['size', 'opacity', 'shape'] as const) {
        const scale = channels[channel];
        if (!scale) continue;
        if (scale.members) {
            list(channel, scale.field.label, scale.members.map((value, i) => ({ label: memberLabel(scale.field, value, format), level: channel === 'shape' ? i : (i + 1) / scale.members!.length })), channel === 'size' ? 22 : 18);
        } else if (scale.domain) {
            // The ends of the range and the middle are enough to read a size or an opacity against.
            const [low, high] = scale.domain;
            const own = spec.scales?.[channel as 'size' | 'opacity']?.independent;
            const samples = own ? [0, 1] : low === high ? [low] : [low, (low + high) / 2, high];
            list(channel, scale.field.label, own ? samples.map((level, i) => ({ label: ends[i], level }))
                : samples.map(value => ({ label: format.tick(value), level: levelOf(scale, value, channel === 'size') })), channel === 'size' ? 22 : 18);
        }
    }
    return blocks;
}
function legendWidth(blocks: LegendBlock[]): number {
    if (!blocks.length) return 0;
    const widest = Math.max(...blocks.map(block => Math.max(textWidth(block.title, metrics.fontSize, 600),
        block.kind === 'ramp' ? 110 : Math.max(0, ...block.entries.map(entry => textWidth(entry.label))) + (block.channel === 'size' ? 26 : 18))));
    return Math.ceil(Math.min(metrics.legendMaxWidth, Math.max(metrics.legendMinWidth, widest + 24)));
}

function buildFrame(rows: AxisLayout, columns: AxisLayout, spec: WorksheetSpec, right: number, format: Format, headerBudget?: number): Frame {
    const pad = metrics.headerPadding * 2;
    const widest = (layout: AxisLayout, level: number) => Math.max(0, ...layout.levels[level].map(span => textWidth(memberLabel(spec.instances[span.part.instanceId], span.part.value, format))));
    const rowHeaderWidths = rows.levels.map((_, level) => Math.min(metrics.headerMaxWidth,
        Math.max(metrics.headerMinWidth, Math.ceil(Math.max(widest(rows, level), textWidth(rows.captions[level], metrics.fontSize, 600)) + pad))));
    // Deep row headers must not push the marks out of a narrow window. Over budget, every level
    // gives up width in proportion and its labels are cut with an ellipsis; no level is dropped.
    const headerTotal = rowHeaderWidths.reduce((a, b) => a + b, 0);
    if (headerBudget && headerTotal > headerBudget) {
        const floor = metrics.headerMinWidth / 2;
        const scale = Math.max(headerBudget, floor * rowHeaderWidths.length) / headerTotal;
        rowHeaderWidths.forEach((width, level) => { rowHeaderWidths[level] = Math.max(floor, Math.floor(width * scale)); });
    }
    const tickWidth = Math.max(0, ...rows.leaves.flatMap(leaf => leaf.scale ? leaf.scale.ticks.map((t, i) => textWidth(leaf.scale!.labels?.[i] ?? format.tick(t), 10)) : []));
    const yAxisWidth = rows.leaves.some(leaf => leaf.kind === 'continuous') ? Math.ceil(tickWidth) + 30 : 0;
    const inner = columns.levels.length - 1;
    const innerWidth = inner >= 0 ? widest(columns, inner) : 0;
    const member = columns.leaves.find(leaf => leaf.kind === 'band' && leaf.path.length === inner + 1);
    const rotateColumnLabels = Boolean(member) && innerWidth + 8 > member!.size;
    const columnHeaderHeights = columns.levels.map((_, level) => rotateColumnLabels && level === inner ? Math.ceil(Math.min(innerWidth, metrics.rotatedLabelMax)) + 10 : metrics.headerHeight);
    const columnCaptionHeight = columns.levels.length ? metrics.captionHeight : 0;
    // With a value axis on the rows, the member names of the innermost column field read better under the marks.
    const valueAxisOnRows = rows.leaves.some(leaf => leaf.kind === 'continuous');
    const membersOnly = columns.leaves.length > 0 && columns.leaves.every(leaf => leaf.kind === 'band' && leaf.path.length === inner + 1);
    const atBottom = membersOnly && (spec.innerColumnHeader ? spec.innerColumnHeader === 'bottom' : valueAxisOnRows);
    const bottomHeaderHeight = atBottom ? columnHeaderHeights[inner] : 0;
    const top = Math.max(rows.levels.length ? metrics.captionHeight : 0, columnCaptionHeight + columnHeaderHeights.reduce((a, b) => a + b, 0) - bottomHeaderHeight);
    return {
        left: rowHeaderWidths.reduce((a, b) => a + b, 0) + yAxisWidth,
        top,
        bottom: columns.leaves.some(leaf => leaf.kind === 'continuous') ? metrics.xAxisHeight : bottomHeaderHeight,
        right, bottomHeaderHeight,
        rowHeaderWidths, columnHeaderHeights, rotateColumnLabels, columnCaptionHeight, yAxisWidth,
    };
}

/**
 * Builds the axis layouts and sparse panes. The members under a header are the union of
 * what occurs anywhere along the other axis, so a pane without a record for some member
 * still leaves that member's slot empty. Absent intersections allocate no pane.
 * With spec.fit and a target size, leaf steps are scaled so the sheet fills the target.
 * With spec.stretch, the target is the window the sheet scrolls in: continuous slots share what the
 * member steps leave of it, and target.scrollbar is the thickness of a scroll bar, which takes
 * its room from the other direction when the sheet does not fit.
 * target.headerWidth caps the total width of the row headers. target.font is the font texts are measured in.
 * formats says how numbers, dates and the sheet's own words are written; the labels built here already follow it.
 * zoom replaces the range of the axes it names; marks outside a zoomed range are cut off at the edge of their pane.
 */
/** Ranges that replace what the data asks for, by the key of the axis scale. */
export type Zoom = Readonly<Record<string, readonly [number, number]>>;

export function buildModel(plan: Plan, results: Map<string, Row[]>, target?: { width: number; height: number; headerWidth?: number; font?: string; scrollbar?: number }, formats?: Formats, zoom?: Zoom): WorksheetModel {
    const { spec } = plan;
    setFont(target?.font);
    const format = resolveFormats(formats);
    const rowDrafts = new Map<string, LeafDraft>();
    const columnDrafts = new Map<string, LeafDraft>();
    const cells = new Map<string, { row: string; column: string; items: CellItem[] }>();
    for (const binding of plan.bindings) {
        for (const record of results.get(binding.taskId) ?? []) {
            const row = draft('row', binding.row, record);
            const column = draft('column', binding.column, record);
            if (!rowDrafts.has(row.id)) rowDrafts.set(row.id, row);
            if (!columnDrafts.has(column.id)) columnDrafts.set(column.id, column);
            const id = JSON.stringify([row.groupId, column.groupId]);
            let cell = cells.get(id);
            if (!cell) cells.set(id, cell = { row: row.groupId, column: column.groupId, items: [] });
            cell.items.push({ record, row: row.id, column: column.id });
        }
    }
    const direction = spec.sort === 'descending' ? -1 : 1;
    const ranks = new Map(Object.entries(spec.order ?? {}).filter(([, order]) => Array.isArray(order))
        .map(([id, order]) => [id, new Map((order as Value[]).map((value, index) => [valueKey(value), index]))]));
    // Values that order members by a measure, per field and per parent path.
    const parentKey = (id: string, parent: { instanceId: string; value: Value }[]) => JSON.stringify([id, parent.map(p => [p.instanceId, typed(p.value)])]);
    const measured = new Map<string, Map<string, number>>();
    for (const ranking of plan.rankings) for (const record of results.get(ranking.taskId) ?? []) {
        const key = parentKey(ranking.instanceId, ranking.parents.map(p => ({ instanceId: p.id, value: record[p.field] as Value })));
        const raw = record[resultKey(ranking.by)];
        let values = measured.get(key);
        if (!values) measured.set(key, values = new Map());
        if (typeof raw === 'number' && Number.isFinite(raw)) values.set(valueKey(record[spec.instances[ranking.instanceId].field]), raw);
    }
    const byMeasure = new Map(plan.rankings.map(r => [r.instanceId, r.direction === 'descending' ? -1 : 1]));
    const compare: MemberCompare = (id, a, b, parent) => {
        const sign = byMeasure.get(id);
        if (sign) {
            const values = measured.get(parentKey(id, parent));
            const va = values?.get(valueKey(a)), vb = values?.get(valueKey(b));
            // A member without a value comes last whichever way the rest runs. Equal values fall back to value order.
            if (va === undefined || vb === undefined) return va !== undefined ? -1 : vb !== undefined ? 1 : compareValue(a, b);
            return (va - vb) * sign || compareValue(a, b);
        }
        const order = spec.order?.[id];
        const rank = ranks.get(id);
        if (!rank) return compareValue(a, b) * (order ? (order === 'descending' ? -1 : 1) : direction);
        // Listed members come first in list order, the rest follow by value.
        const ra = rank.get(valueKey(a)), rb = rank.get(valueKey(b));
        return ra !== undefined && rb !== undefined ? ra - rb : ra !== undefined ? -1 : rb !== undefined ? 1 : compareValue(a, b);
    };
    const sizes = leafSizes(spec);
    const rows = buildAxis('row', rowDrafts.values(), compare, sizes.row, spec.instances);
    const columns = buildAxis('column', columnDrafts.values(), compare, sizes.column, spec.instances);
    const rowIndex = new Map(rows.leaves.map(leaf => [leaf.id, leaf.index]));
    const columnIndex = new Map(columns.leaves.map(leaf => [leaf.id, leaf.index]));
    const rowGroups = new Map(rows.groups.map(group => [group.id, group]));
    const columnGroups = new Map(columns.groups.map(group => [group.id, group]));

    const panes: Pane[] = [];
    const paneIndex = new Map<string, Pane>();
    const colors = new Map<string, Value>();
    const color = spec.color ? spec.instances[spec.color] : undefined;
    const extent: [number, number] = [Infinity, -Infinity];
    // Size, opacity and shape span the complete result too, so a mark keeps its look when the window moves.
    const channels: WorksheetModel['channels'] = {};
    const spans = (['size', 'opacity', 'shape'] as const).flatMap(channel => {
        const field = spec[channel] ? spec.instances[spec[channel]!] : undefined;
        return field ? [{ channel, field, members: new Map<string, Value>(), domain: [Infinity, -Infinity] as [number, number] }] : [];
    });
    for (const cell of cells.values()) for (const { record } of cell.items) {
        for (const span of spans) {
            if (span.field.display === 'discrete') span.members.set(valueKey(record[span.field.field]), record[span.field.field]);
            else {
                const raw = record[resultKey(span.field)];
                if (typeof raw === 'number' && Number.isFinite(raw)) { span.domain[0] = Math.min(span.domain[0], raw); span.domain[1] = Math.max(span.domain[1], raw); }
            }
        }
        if (color?.display === 'discrete') colors.set(valueKey(record[color.field]), record[color.field]);
        if (color?.display === 'continuous') {
            const raw = record[resultKey(color)];
            if (raw != null && Number.isFinite(Number(raw))) { extent[0] = Math.min(extent[0], Number(raw)); extent[1] = Math.max(extent[1], Number(raw)); }
        }
    }
    const palette = [...colors.values()].sort(compareValue);
    for (const span of spans) {
        const options = span.channel === 'shape' ? undefined : spec.scales?.[span.channel];
        const scale: ChannelScale = span.field.display === 'discrete' ? { field: span.field, members: [...span.members.values()].sort(compareValue) }
            : { field: span.field, ...continuousRange(span.domain, options) };
        if (options?.range) scale.range = options.range;
        if (scale.members?.length || scale.domain) channels[span.channel] = scale;
    }
    // Boxes of different colors stand side by side in a member step, in legend order and in the same
    // place in every pane. A color field that already heads the members has one box per step anyway.
    const onAxis = color && [...plan.rows, ...plan.columns].some(branch => branchFields(branch).some(f => f.field === color.field));
    const slots = spec.mark === 'boxplot' && color && !onAxis ? new Map(palette.map((value, index) => [valueKey(value), index])) : undefined;
    for (const [id, cell] of cells) {
        const row = rowGroups.get(cell.row)!;
        const column = columnGroups.get(cell.column)!;
        const marks = paneMarks(cell.items, row.branch, column.branch, plan, rowIndex, columnIndex, slots);
        const pane: Pane = { id, row, column, records: marks.map(mark => mark.record), marks, xDomain: [0, 1], yDomain: [0, 1] };
        panes.push(pane);
        paneIndex.set(id, pane);
    }
    const scaleColumns = assignScales(columns, 'x', panes, plan, format, zoom), scaleRows = assignScales(rows, 'y', panes, plan, format, zoom);
    const scales = () => { scaleColumns(); scaleRows(); };
    scales();
    // A color range comes from the complete result, like an axis range.
    const colorRange = continuousRange(extent, spec.scales?.color);
    // A range across zero diverges from it, unless its ends or its spread were set by hand.
    const colorScale: ColorScale | undefined = color?.display === 'continuous'
        ? { field: color, domain: colorRange.domain ?? [0, 1], type: colorRange.type, diverging: !colorRange.fixed && !colorRange.type && extent[0] < 0 && extent[1] > 0 } : undefined;
    // Channels set to range independently: every pane gets the extent of its own records.
    for (const channel of ['color', 'size', 'opacity'] as const) {
        const field = spec[channel] ? spec.instances[spec[channel]!] : undefined;
        if (!spec.scales?.[channel]?.independent || field?.display !== 'continuous') continue;
        for (const pane of panes) {
            const own: [number, number] = [Infinity, -Infinity];
            for (const record of pane.records) {
                const raw = record[resultKey(field)];
                if (typeof raw === 'number' && Number.isFinite(raw)) { own[0] = Math.min(own[0], raw); own[1] = Math.max(own[1], raw); }
            }
            const range = continuousRange(own, spec.scales[channel]).domain;
            if (range) (pane.domains ??= {})[channel] = range;
        }
    }
    const legends = buildLegends(spec, palette, colorScale, channels, format);
    const measure = () => buildFrame(rows, columns, spec, legendWidth(legends), format, target?.headerWidth);
    let frame = measure();
    const fitWidth = target && (spec.fit === 'width' || spec.fit === 'both') && columns.size > 0;
    const fitHeight = target && (spec.fit === 'height' || spec.fit === 'both') && rows.size > 0;
    // Header and axis sizes depend on the steps and the steps on what the headers leave over.
    // Two rounds settle it; the frame of the first round is kept so the second fits it exactly.
    if (fitWidth || fitHeight) for (let round = 0; round < 2; round++) {
        if (fitWidth) scaleAxis(columns, Math.max(1, target!.width - frame.left - frame.right) / columns.size);
        if (fitHeight) scaleAxis(rows, Math.max(1, target!.height - frame.top - frame.bottom) / rows.size);
        scales();
        if (round === 0) frame = measure();
    }
    // A short table still leaves room for its legend.
    const legendHeight = legends.reduce((sum, block) => sum + Math.min(block.height, legendTitleHeight + 16 * block.step + 6), 0);
    const stretch = target && !spec.fit ? spec.stretch : undefined;
    if (target && stretch && columns.leaves.length && rows.leaves.length) {
        const { width: windowWidth, height: windowHeight } = target;
        const pie = spec.mark === 'arc', wide = stretch !== 'height', tall = stretch !== 'width';
        const floors = leafFloors(spec);
        // Pies are squares, so they only grow when both directions may.
        const grows = pie ? stretch === 'both' : true;
        const least = {
            width: pie ? (grows ? columns.leaves.length * floors.column : columns.size) : wide ? leastSize(columns, floors.column) : columns.size,
            height: pie ? (grows ? rows.leaves.length * floors.row : rows.size) : tall ? leastSize(rows, floors.row) : rows.size,
        };
        // A sheet that does not fit one way gets a scroll bar, which takes room from the other way.
        // Whether it fits is decided on the least size, and a bar that came never goes, so this settles.
        const bar = target.scrollbar ?? 0;
        let across = false, down = false;
        const bars = () => {
            let changed = false;
            for (let pass = 0; pass < 2; pass++) {
                if (!across && frame.left + least.width + frame.right > windowWidth - (down ? bar : 0) + .5) across = changed = true;
                if (!down && windowHeight > 0 && Math.max(frame.top + least.height + frame.bottom, legendHeight) > windowHeight - (across ? bar : 0) + .5) down = changed = true;
            }
            return changed;
        };
        const place = () => {
            const roomX = windowWidth - (down ? bar : 0) - frame.left - frame.right, roomY = windowHeight - (across ? bar : 0) - frame.top - frame.bottom;
            if (pie) {
                if (!grows) return;
                const side = Math.max(floors.column, Math.min(roomX / columns.leaves.length, roomY / rows.leaves.length));
                resizeAxis(columns, () => side);
                resizeAxis(rows, () => side);
            } else {
                if (wide) stretchAxis(columns, roomX, floors.column);
                if (tall) stretchAxis(rows, roomY, floors.row);
            }
            scales();
        };
        // The axis labels depend on the slot sizes and the slot sizes on the room the labels leave.
        let settled = false;
        for (let round = 0; round < 3 && !settled; round++) {
            bars();
            place();
            const next = measure();
            settled = next.left === frame.left && next.right === frame.right && next.top === frame.top && next.bottom === frame.bottom;
            frame = next;
            if (settled) settled = !bars();
        }
        // The last frame is kept and the slots are fitted to it exactly.
        if (!settled) place();
    }
    for (const pane of panes) {
        pane.xDomain = columns.leaves[pane.column.start].scale?.domain ?? [0, 1];
        pane.yDomain = rows.leaves[pane.row.start].scale?.domain ?? [0, 1];
    }
    return { plan, rows, columns, panes, paneIndex, frame, width: frame.left + columns.size + frame.right,
        height: Math.max(frame.top + rows.size + frame.bottom, legendHeight), colors: palette, colorScale, channels, legends, format };
}
