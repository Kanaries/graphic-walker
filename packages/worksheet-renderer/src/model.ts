import { compareValue, displayValue, pathKey, valueKey } from './keys';
import { buildAxis, formatTick, leafSizes, metrics, scaleAxis, tickScale, textWidth, type LeafDraft } from './layout';
import { resultKey, type AxisBranch, type AxisLayout, type AxisLeaf, type Frame, type Pane, type PaneMark, type Plan, type Row, type Value, type WorksheetModel } from './types';

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
    const measure = x?.display === 'continuous' ? x : y?.display === 'continuous' ? y : undefined;
    const series = [plan.spec.color, ...(plan.spec.detail ?? [])].filter((id): id is string => Boolean(id)).map(id => plan.spec.instances[id]);
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
        const raw = measure ? record[resultKey(measure)] : 0;
        const value = raw == null ? NaN : Number(raw);
        if (!Number.isFinite(value)) return { ...leaves, start: NaN, end: NaN };
        if (!stack) return { ...leaves, start: 0, end: value };
        const key = measure === x ? row : column;
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
    const stack = stacked(plan);
    for (const pane of panes) {
        const group = axis === 'x' ? pane.column : pane.row;
        const f = group.branch.position;
        if (!f || f.display !== 'continuous') continue;
        const key = keyOf(layout.leaves[group.start]);
        const extent = extents.get(key) ?? [0, 0];
        for (const mark of pane.marks) {
            const raw = mark.record[resultKey(f)];
            if (raw != null && (typeof raw !== 'number' || !Number.isFinite(raw))) {
                throw new Error(`Continuous field ${f.label} returned a non-finite or non-numeric value. Transform it before rendering.`);
            }
            for (const v of stack ? [mark.start, mark.end] : raw == null ? [] : [raw as number]) {
                if (Number.isFinite(v)) { extent[0] = Math.min(extent[0], v); extent[1] = Math.max(extent[1], v); }
            }
        }
        extents.set(key, extent);
    }
    for (const leaf of layout.leaves) {
        if (leaf.kind !== 'continuous') continue;
        const [min, max] = extents.get(keyOf(leaf)) ?? [0, 1];
        const pixels = leaf.size - metrics.scalePadStart - metrics.scalePadEnd;
        leaf.scale = tickScale(min, max, pixels, axis === 'x' ? 46 : 30);
    }
}

function buildFrame(rows: AxisLayout, columns: AxisLayout): Frame {
    const pad = metrics.headerPadding * 2;
    const widest = (layout: AxisLayout, level: number) => Math.max(0, ...layout.levels[level].map(span => textWidth(displayValue(span.part.value))));
    const rowHeaderWidths = rows.levels.map((_, level) => Math.min(metrics.headerMaxWidth,
        Math.max(metrics.headerMinWidth, Math.ceil(Math.max(widest(rows, level), textWidth(rows.captions[level], metrics.fontSize, 600)) + pad))));
    const tickWidth = Math.max(0, ...rows.leaves.flatMap(leaf => leaf.scale ? leaf.scale.ticks.map(t => textWidth(formatTick(t), 10)) : []));
    const yAxisWidth = rows.leaves.some(leaf => leaf.kind === 'continuous') ? Math.ceil(tickWidth) + 30 : 0;
    const inner = columns.levels.length - 1;
    const innerWidth = inner >= 0 ? widest(columns, inner) : 0;
    const member = columns.leaves.find(leaf => leaf.kind === 'band' && leaf.path.length === inner + 1);
    const rotateColumnLabels = Boolean(member) && innerWidth + 8 > member!.size;
    const columnHeaderHeights = columns.levels.map((_, level) => rotateColumnLabels && level === inner ? Math.ceil(Math.min(innerWidth, metrics.rotatedLabelMax)) + 10 : metrics.headerHeight);
    const columnCaptionHeight = columns.levels.length ? metrics.captionHeight : 0;
    const top = Math.max(rows.levels.length ? metrics.captionHeight : 0, columnCaptionHeight + columnHeaderHeights.reduce((a, b) => a + b, 0));
    return {
        left: rowHeaderWidths.reduce((a, b) => a + b, 0) + yAxisWidth,
        top,
        bottom: columns.leaves.some(leaf => leaf.kind === 'continuous') ? metrics.xAxisHeight : 0,
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
    const sizes = leafSizes(spec);
    const rows = buildAxis('row', rowDrafts.values(), direction, sizes.row, spec.instances);
    const columns = buildAxis('column', columnDrafts.values(), direction, sizes.column, spec.instances);
    const rowIndex = new Map(rows.leaves.map(leaf => [leaf.id, leaf.index]));
    const columnIndex = new Map(columns.leaves.map(leaf => [leaf.id, leaf.index]));
    const rowGroups = new Map(rows.groups.map(group => [group.id, group]));
    const columnGroups = new Map(columns.groups.map(group => [group.id, group]));

    const panes: Pane[] = [];
    const paneIndex = new Map<string, Pane>();
    const colors = new Map<string, Value>();
    const color = spec.color ? spec.instances[spec.color] : undefined;
    for (const [id, cell] of cells) {
        const row = rowGroups.get(cell.row)!;
        const column = columnGroups.get(cell.column)!;
        const marks = paneMarks(cell.items, row.branch, column.branch, plan, rowIndex, columnIndex);
        const pane: Pane = { id, row, column, records: marks.map(mark => mark.record), marks, xDomain: [0, 1], yDomain: [0, 1] };
        if (color) for (const record of pane.records) colors.set(valueKey(record[color.field]), record[color.field]);
        panes.push(pane);
        paneIndex.set(id, pane);
    }
    const scales = () => { assignScales(columns, 'x', panes, plan); assignScales(rows, 'y', panes, plan); };
    scales();
    let frame = buildFrame(rows, columns);
    const fitWidth = target && (spec.fit === 'width' || spec.fit === 'both') && columns.size > 0;
    const fitHeight = target && (spec.fit === 'height' || spec.fit === 'both') && rows.size > 0;
    // Header and axis sizes depend on the steps and the steps on what the headers leave over.
    // Two rounds settle it; the frame of the first round is kept so the second fits it exactly.
    if (fitWidth || fitHeight) for (let round = 0; round < 2; round++) {
        if (fitWidth) scaleAxis(columns, Math.max(1, target!.width - frame.left) / columns.size);
        if (fitHeight) scaleAxis(rows, Math.max(1, target!.height - frame.top - frame.bottom) / rows.size);
        scales();
        if (round === 0) frame = buildFrame(rows, columns);
    }
    for (const pane of panes) {
        pane.xDomain = columns.leaves[pane.column.start].scale?.domain ?? [0, 1];
        pane.yDomain = rows.leaves[pane.row.start].scale?.domain ?? [0, 1];
    }
    return { plan, rows, columns, panes, paneIndex, frame, width: frame.left + columns.size, height: frame.top + rows.size + frame.bottom,
        colors: [...colors.values()].sort(compareValue) };
}
