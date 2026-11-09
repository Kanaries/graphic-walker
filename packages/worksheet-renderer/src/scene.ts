import { displayValue, valueKey } from './keys';
import { branchFields } from './compiler';
import { fitText, formatTick, formatValue, leafRange, metrics, spansIn, textWidth } from './layout';
import { resultKey, type AxisGroup, type AxisLeaf, type FieldInstance, type Pane, type Selection, type Value, type WorksheetModel } from './types';

/** x and y are the scroll offsets, width and height the size of the visible window. */
export interface Viewport { x: number; y: number; width: number; height: number }
/**
 * Painted in this order. The body scrolls both ways, row headers and the value axis on
 * the left scroll vertically, column headers and the bottom axis scroll horizontally,
 * corners stay put. Each later layer has an opaque background and covers what is below.
 */
export const layers = ['body', 'rowHeader', 'columnHeader', 'xAxis', 'corner'] as const;
export type Layer = typeof layers[number];
export interface Primitive {
    kind: 'rect' | 'symbol' | 'path' | 'text';
    layer: Layer;
    x: number; y: number; width?: number; height?: number;
    fill?: string; stroke?: string; path?: string; text?: string;
    align?: 'left' | 'center' | 'right'; angle?: number; size?: number; fontSize?: number; fontWeight?: number; opacity?: number;
    selection?: Selection; tooltip?: string;
}
export interface Scene { width: number; height: number; items: Primitive[]; visiblePanes: number }
export const palette = ['#4263eb', '#e88739', '#169b8d', '#b46bd0', '#dc6275', '#809432', '#3689ab', '#8c6a52'];
const ink = { text: '#344054', muted: '#667085', line: '#d9dfe9', grid: '#eef1f6', zero: '#c2c9d6', paper: '#ffffff' };
const numeric = (value: unknown) => value == null ? NaN : Number(value);
/** Opacity of marks outside a non-empty selection. */
const dimmed = 0.25;
export interface SceneState {
    /** Selection ids. While any is set, every other mark is dimmed. */
    selected?: ReadonlySet<string>;
}

/** Produces pixel geometry for the window. The drawing backend does no grouping, stacking or scaling. */
export function buildScene(model: WorksheetModel, viewport: Viewport, state: SceneState = {}): Scene {
    const items: Primitive[] = [];
    const { spec } = model.plan;
    const { rows, columns, frame } = model;
    const { left, top } = frame;
    const pad = metrics.headerPadding;
    // Screen rectangle of the body. The bottom axis sits under the last row, or on the window edge when the sheet is taller.
    const axisY = Math.max(top, Math.min(viewport.height - frame.bottom, top + rows.size - viewport.y));
    const bodyRight = Math.max(left, Math.min(viewport.width, left + columns.size - viewport.x));
    const [c0, c1] = leafRange(columns, viewport.x, viewport.x + bodyRight - left);
    const [r0, r1] = leafRange(rows, viewport.y, viewport.y + axisY - top);
    const sx = (logical: number) => left + logical - viewport.x;
    const sy = (logical: number) => top + logical - viewport.y;
    const rect = (layer: Layer, x: number, y: number, width: number, height: number, fill: string, extra: Partial<Primitive> = {}) => {
        if (width > 0 && height > 0) items.push({ kind: 'rect', layer, x, y, width, height, fill, ...extra });
    };
    const text = (layer: Layer, x: number, y: number, value: string, extra: Partial<Primitive> = {}) => {
        if (value) items.push({ kind: 'text', layer, x, y, text: value, fill: ink.text, fontSize: metrics.fontSize, ...extra });
    };
    // Distance of a value from the start of its slot.
    const along = (leaf: AxisLeaf, value: number) => {
        const [low, high] = leaf.scale!.domain;
        return metrics.scalePadStart + (value - low) / (high - low) * (leaf.size - metrics.scalePadStart - metrics.scalePadEnd);
    };
    const px = (leaf: AxisLeaf, value: number) => sx(leaf.offset + along(leaf, value));
    const py = (leaf: AxisLeaf, value: number) => sy(leaf.offset + leaf.size - along(leaf, value));

    const colorField = spec.color ? spec.instances[spec.color] : undefined;
    const colorMap = new Map(model.colors.map((c, i) => [valueKey(c), palette[i % palette.length]]));
    const seriesFields = [spec.color, ...(spec.detail ?? [])].filter((id): id is string => Boolean(id)).map(id => spec.instances[id]);
    const selecting = Boolean(state.selected?.size);
    // Labels of members squeezed below one line of text are thinned out, the members themselves stay.
    const stride = (size: number, room: number) => Math.max(1, Math.ceil(room / size));

    // ---- body
    rect('body', left, top, bodyRight - left, axisY - top, ink.paper);
    let visiblePanes = 0;
    if (r1 > r0 && c1 > c0) {
        for (let r = rows.leaves[r0].group; r <= rows.leaves[r1 - 1].group; r++) {
            for (let c = columns.leaves[c0].group; c <= columns.leaves[c1 - 1].group; c++) drawPane(rows.groups[r], columns.groups[c]);
        }
    }
    function drawPane(row: AxisGroup, column: AxisGroup) {
        const x0 = Math.max(sx(column.offset), left), x1 = Math.min(sx(column.offset + column.size), bodyRight);
        const y0 = Math.max(sy(row.offset), top), y1 = Math.min(sy(row.offset + row.size), axisY);
        const xLeaf = columns.leaves[column.start], yLeaf = rows.leaves[row.start];
        // Grid lines belong to the row or column, so they are drawn for empty intersections too.
        if (xLeaf.scale) for (const tick of xLeaf.scale.ticks) {
            const x = Math.round(px(xLeaf, tick));
            if (x >= left && x < bodyRight) rect('body', x, y0, 1, y1 - y0, tick === 0 ? ink.zero : ink.grid);
        }
        if (yLeaf.scale) for (const tick of yLeaf.scale.ticks) {
            const y = Math.round(py(yLeaf, tick));
            if (y >= top && y < axisY) rect('body', x0, y, x1 - x0, 1, tick === 0 ? ink.zero : ink.grid);
        }
        if (sx(column.offset) >= left && column.offset > 0) rect('body', sx(column.offset), y0, 1, y1 - y0, ink.line);
        if (sy(row.offset) >= top && row.offset > 0) rect('body', x0, sy(row.offset), x1 - x0, 1, ink.line);
        const pane = model.paneIndex.get(JSON.stringify([row.id, column.id]));
        if (!pane) return;
        visiblePanes++;
        drawMarks(pane);
    }
    function drawMarks(pane: Pane) {
        const xField = pane.column.branch.position, yField = pane.row.branch.position;
        const xContinuous = xField?.display === 'continuous', yContinuous = yField?.display === 'continuous';
        const used = [...branchFields(pane.row.branch), ...branchFields(pane.column.branch), ...seriesFields];
        const dimensions = [...new Map(used.filter(f => !f.aggregate).map(f => [f.field, f])).values()];
        const described = [...new Map(used.map(f => [f.id, f])).values()];
        const describe = (f: FieldInstance, value: unknown) => `${f.label}: ${typeof value === 'number' && f.aggregate ? formatValue(value) : displayValue(value as Value)}`;
        const isLine = spec.mark === 'line';
        // A line runs along x unless x is the only value axis.
        const alongY = xContinuous && !yContinuous;
        const lines = new Map<string, { selected: boolean; points: { order: number; x: number; y: number; missing: boolean; fill: string }[] }>();
        for (const mark of pane.marks) {
            // Points of a line outside the window still shape the visible segments.
            if (!isLine && (mark.row < r0 || mark.row >= r1 || mark.column < c0 || mark.column >= c1)) continue;
            const { record } = mark;
            const rowLeaf = rows.leaves[mark.row], columnLeaf = columns.leaves[mark.column];
            const xValue = xContinuous ? numeric(record[resultKey(xField!)]) : 0;
            const yValue = yContinuous ? numeric(record[resultKey(yField!)]) : 0;
            const missing = !Number.isFinite(xValue) || !Number.isFinite(yValue);
            const x = xContinuous ? px(columnLeaf, xValue) : sx(columnLeaf.offset + columnLeaf.size / 2);
            const y = yContinuous ? py(rowLeaf, yValue) : sy(rowLeaf.offset + rowLeaf.size / 2);
            const fill = colorField ? colorMap.get(valueKey(record[colorField.field]))! : palette[0];
            const id = JSON.stringify([pane.row.branch.order, pane.column.branch.order, ...dimensions.map(f => valueKey(record[f.field]))]);
            const selected = selecting && state.selected!.has(id);
            if (isLine) {
                const order = alongY ? (yContinuous ? y : mark.row) : (xContinuous ? x : mark.column);
                if (Number.isFinite(order)) {
                    const key = JSON.stringify(seriesFields.map(f => valueKey(record[f.field])));
                    const line = lines.get(key) ?? { selected: false, points: [] };
                    line.points.push({ order, x, y, missing, fill });
                    line.selected ||= selected;
                    lines.set(key, line);
                }
            }
            if (missing) continue;
            const selection: Selection = { id, paneId: pane.id, rowPath: rowLeaf.path, columnPath: columnLeaf.path,
                predicates: dimensions.map(f => ({ field: f.field, value: record[f.field] as Value })), values: record };
            const extra: Partial<Primitive> = { selection, tooltip: described.map(f => describe(f, record[resultKey(f)])).join('\n') };
            if (selecting && !selected) extra.opacity = dimmed;
            if (spec.mark === 'bar') {
                if (!Number.isFinite(mark.start) || !Number.isFinite(mark.end)) continue;
                if (xContinuous) {
                    const a = px(columnLeaf, mark.start), b = px(columnLeaf, mark.end), thickness = Math.max(1, rowLeaf.size * metrics.barFill);
                    rect('body', Math.min(a, b), y - thickness / 2, Math.max(.5, Math.abs(b - a)), thickness, fill, extra);
                } else {
                    const a = py(rowLeaf, mark.start), b = py(rowLeaf, mark.end), thickness = Math.max(1, columnLeaf.size * metrics.barFill);
                    rect('body', x - thickness / 2, Math.min(a, b), thickness, Math.max(.5, Math.abs(b - a)), fill, extra);
                }
            } else if (spec.mark === 'text') {
                const f = xField?.aggregate ? xField : yField?.aggregate ? yField : undefined;
                text('body', x, y + 4, f ? formatTick(Number(record[resultKey(f)])) : '•', { align: 'center', fill, ...extra });
            } else if (spec.mark === 'rect') {
                // A cell mark fills its member step; on a value axis it stays a small square.
                const width = xContinuous ? 10 : columnLeaf.size - 1, height = yContinuous ? 10 : rowLeaf.size - 1;
                rect('body', x - width / 2, y - height / 2, width, height, fill, extra);
            } else {
                items.push({ kind: 'symbol', layer: 'body', x, y, size: isLine ? 22 : 44, fill, ...extra });
            }
        }
        for (const { points, selected } of lines.values()) {
            points.sort((a, b) => a.order - b.order);
            // A missing value ends the current segment; the next valid point starts a new one.
            let path = '';
            let open = false;
            for (const point of points) {
                if (point.missing) { open = false; continue; }
                path += `${open ? 'L' : `${path ? ' ' : ''}M`}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
                open = true;
            }
            if (path) items.push({ kind: 'path', layer: 'body', x: 0, y: 0, path, stroke: points[0].fill, ...(selecting && !selected ? { opacity: dimmed } : {}) });
        }
    }

    // ---- row headers and the value axis on the left
    rect('rowHeader', 0, top, left, axisY - top, ink.paper);
    let headerX = 0;
    rows.levels.forEach((spans, level) => {
        const width = frame.rowHeaderWidths[level];
        for (const span of spansIn(spans, r0, r1)) {
            const first = rows.leaves[span.start], last = rows.leaves[span.end - 1];
            const y0 = sy(first.offset), y1 = sy(last.offset + last.size);
            const label = displayValue(span.part.value);
            const tooltip = `${spec.instances[span.part.instanceId].label}: ${label}`;
            // Dividers separate groups, not the members inside a pane.
            const member = first.kind === 'band' && level === first.path.length - 1;
            if (!member && y0 >= top && first.offset > 0) rect('rowHeader', headerX, y0, left - headerX, 1, ink.line);
            // A parent whose start has scrolled away keeps its label in the visible part.
            if (member && span.start % stride(first.size, 13)) continue;
            const baseline = member ? (y0 + y1) / 2 + 4 : Math.max(y0, top) + 16;
            if (baseline > top + 6 && baseline <= (member ? axisY : Math.min(y1, axisY) - 3)) text('rowHeader', headerX + pad, baseline, fitText(label, width - pad * 2), { tooltip });
        }
        headerX += width;
    });
    for (let i = r0; i < r1; i++) {
        const leaf = rows.leaves[i];
        if (!leaf.scale) continue;
        for (const tick of leaf.scale.ticks) {
            const y = Math.round(py(leaf, tick));
            if (y < top || y > axisY) continue;
            rect('rowHeader', left - 4, y, 4, 1, ink.line);
            text('rowHeader', left - 7, y + 3.5, formatTick(tick), { align: 'right', fontSize: 10, fill: ink.muted });
        }
        const y0 = Math.max(sy(leaf.offset), top), y1 = Math.min(sy(leaf.offset + leaf.size), axisY);
        const title = leaf.branch.position!.label;
        if (y1 - y0 > 40) text('rowHeader', left - frame.yAxisWidth + 11, (y0 + y1) / 2, fitText(title, y1 - y0 - 8, 10, 600), { angle: 270, align: 'center', fontSize: 10, fontWeight: 600, tooltip: title });
    }
    rect('rowHeader', left - 1, top, 1, axisY - top, ink.line);

    // ---- column headers
    rect('columnHeader', left, 0, viewport.width - left, top, ink.paper);
    if (frame.columnCaptionHeight && bodyRight - left > 40) {
        const caption = columns.captions.join(' / ');
        text('columnHeader', (left + bodyRight) / 2, 15, fitText(caption, bodyRight - left - 8, 10), { align: 'center', fontSize: 10, fill: ink.muted, tooltip: caption });
    }
    let headerY = frame.columnCaptionHeight;
    columns.levels.forEach((spans, level) => {
        const height = frame.columnHeaderHeights[level];
        const rotated = frame.rotateColumnLabels && level === columns.levels.length - 1;
        for (const span of spansIn(spans, c0, c1)) {
            const first = columns.leaves[span.start], last = columns.leaves[span.end - 1];
            const x0 = sx(first.offset), x1 = sx(last.offset + last.size);
            const label = displayValue(span.part.value);
            const tooltip = `${spec.instances[span.part.instanceId].label}: ${label}`;
            const member = first.kind === 'band' && level === first.path.length - 1;
            if (!member && x0 >= left && first.offset > 0) rect('columnHeader', x0, headerY, 1, top - headerY, ink.line);
            const v0 = Math.max(x0, left), v1 = Math.min(x1, bodyRight);
            if (member && span.start % stride(first.size, rotated ? 12 : 1)) continue;
            if (rotated) {
                const center = (x0 + x1) / 2;
                if (center >= left && center <= bodyRight) text('columnHeader', center + 4, headerY + height - 5, fitText(label, height - 8), { angle: 270, tooltip });
            } else if (v1 - v0 > 14) {
                text('columnHeader', (v0 + v1) / 2, headerY + 16, fitText(label, v1 - v0 - 8), { align: 'center', tooltip });
            }
        }
        headerY += height;
    });
    rect('columnHeader', left, top - 1, viewport.width - left, 1, ink.line);

    // ---- value axis under the body
    if (frame.bottom) {
        rect('xAxis', left, axisY, viewport.width - left, frame.bottom, ink.paper);
        rect('xAxis', left, axisY, bodyRight - left, 1, ink.line);
        for (let i = c0; i < c1; i++) {
            const leaf = columns.leaves[i];
            if (!leaf.scale) continue;
            const s0 = sx(leaf.offset), s1 = s0 + leaf.size;
            if (s0 >= left && leaf.offset > 0) rect('xAxis', s0, axisY, 1, frame.bottom, ink.line);
            for (const tick of leaf.scale.ticks) {
                const x = Math.round(px(leaf, tick));
                if (x < left || x > bodyRight) continue;
                const label = formatTick(tick);
                const half = textWidth(label, 10) / 2;
                rect('xAxis', x, axisY, 1, 4, ink.line);
                text('xAxis', x, axisY + 15, label, { align: x - half < s0 + 2 ? 'left' : x + half > s1 - 2 ? 'right' : 'center', fontSize: 10, fill: ink.muted });
            }
            const v0 = Math.max(s0, left), v1 = Math.min(s1, bodyRight);
            const title = leaf.branch.position!.label;
            if (v1 - v0 > 40) text('xAxis', (v0 + v1) / 2, axisY + 31, fitText(title, v1 - v0 - 8, 10, 600), { align: 'center', fontSize: 10, fontWeight: 600, tooltip: title });
        }
    }

    // ---- corners
    rect('corner', 0, 0, left, top, ink.paper);
    let captionX = 0;
    rows.captions.forEach((caption, level) => {
        const width = frame.rowHeaderWidths[level];
        text('corner', captionX + pad, top - 8, fitText(caption, width - pad * 2, metrics.fontSize, 600), { fontWeight: 600, tooltip: caption });
        captionX += width;
    });
    rect('corner', 0, top - 1, left, 1, ink.line);
    rect('corner', left - 1, 0, 1, top, ink.line);
    if (frame.bottom) {
        rect('corner', 0, axisY, left, frame.bottom, ink.paper);
        rect('corner', 0, axisY, left, 1, ink.line);
    }
    return { width: viewport.width, height: viewport.height, items, visiblePanes };
}
