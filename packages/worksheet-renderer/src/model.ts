import { compareValue, displayValue, pathKey, valueKey } from './keys';
import { buildAxis, formatTick, leafSizes, metrics, scaleAxis, tickScale, textWidth, type LeafDraft, type MemberCompare } from './layout';
import { positionValue, timeScale } from './time';
import { valueAxis } from './compiler';
import { resultKey, type AxisBranch, type AxisLayout, type AxisLeaf, type ColorScale, type Frame, type Pane, type PaneMark, type Plan, type Row, type Value, type WorksheetModel, type WorksheetSpec } from './types';

function draft(axis: 'row' | 'column', branch: AxisBranch, record: Row): LeafDraft {
    const facets = branch.facets.map(f => ({ instanceId: f.id, value: record[f.field] as Value }));
    const groupId = JSON.stringify([branch.id, pathKey(axis, facets)]);
    if (branch.position?.display !== 'discrete') return { id: groupId, groupId, branch, path: facets, kind: branch.position ? 'continuous' : 'single' };
    const path = [...facets, { instanceId: branch.position.id, value: record[branch.position.field] as Value }];
    return { id: JSON.stringify([branch.id, pathKey(axis, path)]), groupId, branch, path, kind: 'band' };
}

export const stacked = (plan: Plan) => plan.spec.mark === 'bar' && plan.spec.stack !== false;

interface CellItem { record: Row; row: string; column: string }

// Orders the records of one pane by series and gives each its interval on the measure axis.
// Stacking accumulates per member, positive and negative values apart.
function paneMarks(items: CellItem[], rowBranch: AxisBranch, columnBranch: AxisBranch, plan: Plan, rowIndex: Map<string, number>, columnIndex: Map<string, number>): PaneMark[] {
    const x = columnBranch.position;
    const y = rowBranch.position;
    const axis = valueAxis(x, y);
    const measure = axis === 'x' ? x : axis === 'y' ? y : undefined;
    // Bars placed along a continuous field stack per position, not per pane.
    const other = axis === 'x' ? y : x;
    const along = other?.display === 'continuous' ? other : undefined;
    // Only dimensions split a pane into series. A measure on color tints the marks without dividing them.
    const series = [plan.spec.color, ...(plan.spec.detail ?? [])].filter((id): id is string => Boolean(id)).map(id => plan.spec.instances[id]).filter(f => !f.aggregate);
    const sorted = [...items].sort((a, b) => {
        for (const f of series) {
            const cmp = compareValue(a.record[f.field], b.record[f.field]);
            if (cmp) return cmp;
        }
        return 0;
    });
    const totals = new Map<string, [number, number]>();
    const stack = stacked(plan);
    return sorted.map(({ record, row, column }) => {
        const leaves = { record, row: rowIndex.get(row)!, column: columnIndex.get(column)! };
        const value = measure ? positionValue(measure, record) : 0;
        if (!Number.isFinite(value)) return { ...leaves, start: NaN, end: NaN };
        if (!stack) return { ...leaves, start: 0, end: value };
        const key = (axis === 'x' ? row : column) + (along ? `|${positionValue(along, record)}` : '');
        const total = totals.get(key) ?? [0, 0];
        const sign = value >= 0 ? 0 : 1;
        const start = total[sign];
        total[sign] += value;
        totals.set(key, total);
        return { ...leaves, start, end: total[sign] };
    });
}

// Ranges come from the complete result, never from the visible window. A range is keyed
// by measure and by a scope along the axis itself, so every pane in one row or column
// shares it and the axis can be drawn once on the table edge.
function assignScales(layout: AxisLayout, axis: 'x' | 'y', panes: Pane[], plan: Plan) {
    const scope = plan.spec.scaleScope ?? 'shared';
    const keyOf = (leaf: AxisLeaf) => {
        const id = leaf.branch.position!.id;
        return scope === 'independent' ? leaf.id : scope === 'prefix' ? JSON.stringify([id, pathKey(layout.axis, leaf.path.slice(0, 1))]) : id;
    };
    const extents = new Map<string, [number, number]>();
    const positions = new Map<string, Set<number>>();
    const stack = stacked(plan);
    const bars = plan.spec.mark === 'bar';
    for (const pane of panes) {
        const group = axis === 'x' ? pane.column : pane.row;
        const f = group.branch.position;
        if (!f || f.display !== 'continuous') continue;
        const key = keyOf(layout.leaves[group.start]);
        const time = f.scale === 'time';
        // A value axis starts from zero. A date axis has no zero worth showing.
        const extent = extents.get(key) ?? (time ? [Infinity, -Infinity] : [0, 0]);
        const carriesValue = valueAxis(pane.column.branch.position, pane.row.branch.position) === axis;
        const distinct = bars && !carriesValue ? positions.get(key) ?? new Set<number>() : undefined;
        for (const mark of pane.marks) {
            const raw = mark.record[resultKey(f)];
            const value = positionValue(f, mark.record);
            if (raw != null && (time ? Number.isNaN(value) : typeof raw !== 'number' || !Number.isFinite(raw))) {
                throw new Error(time ? `Time field ${f.label} returned a value that is not a date: ${String(raw)}`
                    : `Continuous field ${f.label} returned a non-finite or non-numeric value. Transform it before rendering.`);
            }
            if (Number.isFinite(value)) distinct?.add(value);
            for (const v of stack && carriesValue ? [mark.start, mark.end] : [value]) {
                if (Number.isFinite(v)) { extent[0] = Math.min(extent[0], v); extent[1] = Math.max(extent[1], v); }
            }
        }
        extents.set(key, extent);
        if (distinct) positions.set(key, distinct);
    }
    for (const leaf of layout.leaves) {
        if (leaf.kind !== 'continuous') continue;
        const key = keyOf(leaf);
        const time = leaf.branch.position!.scale === 'time';
        let [min, max] = extents.get(key) ?? [0, 1];
        if (min > max) [min, max] = time ? [0, 86_400_000] : [0, 1];
        // Bars along this axis need half a step of room at both ends, or the outer ones are cut in half.
        const sorted = [...positions.get(key) ?? []].sort((a, b) => a - b);
        const step = sorted.length > 1 ? Math.min(...sorted.slice(1).map((v, i) => v - sorted[i])) : undefined;
        if (step) { min -= step / 2; max += step / 2; }
        const pixels = leaf.size - metrics.scalePadStart - metrics.scalePadEnd;
        leaf.scale = { ...(time ? timeScale(min, max, pixels, axis === 'x' ? 62 : 30) : tickScale(min, max, pixels, axis === 'x' ? 46 : 30)), step };
    }
}

function buildFrame(rows: AxisLayout, columns: AxisLayout, spec: WorksheetSpec, colors: Value[], colorScale?: ColorScale): Frame {
    const pad = metrics.headerPadding * 2;
    const widest = (layout: AxisLayout, level: number) => Math.max(0, ...layout.levels[level].map(span => textWidth(displayValue(span.part.value))));
    const rowHeaderWidths = rows.levels.map((_, level) => Math.min(metrics.headerMaxWidth,
        Math.max(metrics.headerMinWidth, Math.ceil(Math.max(widest(rows, level), textWidth(rows.captions[level], metrics.fontSize, 600)) + pad))));
    const tickWidth = Math.max(0, ...rows.leaves.flatMap(leaf => leaf.scale ? leaf.scale.ticks.map((t, i) => textWidth(leaf.scale!.labels?.[i] ?? formatTick(t), 10)) : []));
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
    let right = 0;
    if (spec.color) {
        const title = textWidth(spec.instances[spec.color].label, metrics.fontSize, 600);
        const widestItem = colorScale ? 110 : Math.max(0, ...colors.map(c => textWidth(displayValue(c)))) + 18;
        right = Math.ceil(Math.min(metrics.legendMaxWidth, Math.max(metrics.legendMinWidth, Math.max(title, widestItem) + 24)));
    }
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
 */
export function buildModel(plan: Plan, results: Map<string, Row[]>, target?: { width: number; height: number }): WorksheetModel {
    const { spec } = plan;
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
    const compare: MemberCompare = (id, a, b) => {
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
    for (const [id, cell] of cells) {
        const row = rowGroups.get(cell.row)!;
        const column = columnGroups.get(cell.column)!;
        const marks = paneMarks(cell.items, row.branch, column.branch, plan, rowIndex, columnIndex);
        const pane: Pane = { id, row, column, records: marks.map(mark => mark.record), marks, xDomain: [0, 1], yDomain: [0, 1] };
        if (color && !color.aggregate) for (const record of pane.records) colors.set(valueKey(record[color.field]), record[color.field]);
        if (color?.aggregate) for (const record of pane.records) {
            const raw = record[resultKey(color)];
            if (raw != null && Number.isFinite(Number(raw))) { extent[0] = Math.min(extent[0], Number(raw)); extent[1] = Math.max(extent[1], Number(raw)); }
        }
        panes.push(pane);
        paneIndex.set(id, pane);
    }
    const scales = () => { assignScales(columns, 'x', panes, plan); assignScales(rows, 'y', panes, plan); };
    scales();
    const palette = [...colors.values()].sort(compareValue);
    // A color range comes from the complete result, like an axis range.
    const colorScale: ColorScale | undefined = color?.aggregate
        ? { field: color, domain: extent[0] <= extent[1] ? extent : [0, 1], diverging: extent[0] < 0 && extent[1] > 0 } : undefined;
    const measure = () => buildFrame(rows, columns, spec, palette, colorScale);
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
    for (const pane of panes) {
        pane.xDomain = columns.leaves[pane.column.start].scale?.domain ?? [0, 1];
        pane.yDomain = rows.leaves[pane.row.start].scale?.domain ?? [0, 1];
    }
    // A short table still leaves room for its legend.
    const legendHeight = colorScale ? 64 : spec.color ? 30 + Math.min(palette.length, 16) * 18 : 0;
    return { plan, rows, columns, panes, paneIndex, frame, width: frame.left + columns.size + frame.right,
        height: Math.max(frame.top + rows.size + frame.bottom, legendHeight), colors: palette, colorScale };
}
