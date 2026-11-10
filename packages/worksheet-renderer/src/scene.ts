import { continuousColor, fillOf, lightTheme, type Theme } from './color';
import { displayValue, valueKey } from './keys';
import { branchFields, valueAxis } from './compiler';
import { fitText, formatTick, formatValue, leafRange, metrics, spansIn, textWidth } from './layout';
import { fieldTime, formatTime, memberLabel, positionValue } from './time';
import { resultKey, type AxisGroup, type AxisLeaf, type FieldInstance, type Pane, type Selection, type Value, type WorksheetModel } from './types';

/** x and y are the scroll offsets, width and height the size of the visible window. */
export interface Viewport { x: number; y: number; width: number; height: number }
/**
 * Painted in this order. The body scrolls both ways, row headers and the value axis on
 * the left scroll vertically, column headers and the bottom axis scroll horizontally,
 * corners and the legend stay put. Each later layer has an opaque background and covers
 * what is below. The xAxis layer is the strip under the body: the value axis of the
 * columns, or the innermost column headers when those are placed at the bottom.
 */
export const layers = ['body', 'rowHeader', 'columnHeader', 'xAxis', 'corner', 'legend'] as const;
export type Layer = typeof layers[number];
export interface Primitive {
    /** path is an open stroked line. shape is a closed filled outline, such as a pie slice; its path is relative to x and y. */
    kind: 'rect' | 'symbol' | 'path' | 'shape' | 'text';
    layer: Layer;
    x: number; y: number; width?: number; height?: number;
    fill?: string; stroke?: string; strokeWidth?: number; path?: string; text?: string;
    align?: 'left' | 'center' | 'right'; angle?: number; size?: number; fontSize?: number; fontWeight?: number; opacity?: number;
    selection?: Selection; tooltip?: string;
}
export interface Scene {
    width: number; height: number; items: Primitive[]; visiblePanes: number;
    /** The surface color. Every layer paints it, so the backend may also clear with it. */
    background: string;
    /** 'omitted' when the window is too narrow for the legend strip; the host should show the colors some other way. */
    legend: 'none' | 'side' | 'omitted';
}
/** Opacity of marks outside a non-empty selection. */
const dimmed = 0.25;
/** Outline of a pie slice around the origin, from share `start` to share `end` of a turn, clockwise from twelve o'clock. */
function slice(radius: number, start: number, end: number): string {
    const point = (share: number) => `${(Math.sin(share * 2 * Math.PI) * radius).toFixed(2)},${(-Math.cos(share * 2 * Math.PI) * radius).toFixed(2)}`;
    const arc = (to: number, large: boolean) => `A${radius},${radius} 0 ${large ? 1 : 0} 1 ${point(to)}`;
    // A whole disc cannot be one arc, because its start and end coincide.
    if (end - start > 1 - 1e-9) return `M${point(0)}${arc(.5, false)}${arc(1, false)}Z`;
    return `M0,0L${point(start)}${arc(end, end - start > .5)}Z`;
}
export interface SceneState {
    /** Selection ids. While any is set, every other mark is dimmed. */
    selected?: ReadonlySet<string>;
    /** Surface, text and rule colors. Light when absent. */
    theme?: Theme;
}

/** Produces pixel geometry for the window. The drawing backend does no grouping, stacking or scaling. */
export function buildScene(model: WorksheetModel, viewport: Viewport, state: SceneState = {}): Scene {
    const items: Primitive[] = [];
    const { spec } = model.plan;
    const { rows, columns, frame } = model;
    const { left, top } = frame;
    const ink = state.theme ?? lightTheme;
    const pad = metrics.headerPadding;
    // The legend strip is drawn when the whole sheet fits, or when the body still keeps a usable
    // share of a window narrower than the sheet. Otherwise it is left out.
    const roomy = left + columns.size + frame.right <= viewport.width || viewport.width - left - frame.right >= Math.max(120, viewport.width * 0.3);
    const right = frame.right && roomy ? frame.right : 0;
    // Screen rectangle of the body. The bottom axis sits under the last row, or on the window edge when the sheet is taller.
    const axisY = Math.max(top, Math.min(viewport.height - frame.bottom, top + rows.size - viewport.y));
    const bodyRight = Math.max(left, Math.min(viewport.width - right, left + columns.size - viewport.x));
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
    const tickLabel = (leaf: AxisLeaf, index: number) => leaf.scale!.labels?.[index] ?? formatTick(leaf.scale!.ticks[index]);
    // Width of a bar placed at a continuous position: a share of the smallest gap between positions, so
    // neighbours never touch and every pane on the same scale gets the same width.
    const barAt = (leaf: AxisLeaf) => {
        const { step, domain } = leaf.scale!;
        if (!step) return 12;
        return Math.min(28, Math.max(1, step / (domain[1] - domain[0]) * (leaf.size - metrics.scalePadStart - metrics.scalePadEnd) * metrics.barFill));
    };

    const colorField = spec.color ? spec.instances[spec.color] : undefined;
    // Cells of a heat map take the theme's heat map stops, other marks its ramp.
    const cells = spec.mark === 'rect';
    const fill = fillOf(colorField, model.colors, model.colorScale, ink, cells);
    const textField = spec.mark === 'text' && spec.text ? spec.instances[spec.text] : undefined;
    const angleField = spec.mark === 'arc' && spec.angle ? spec.instances[spec.angle] : undefined;
    const encodingFields = [spec.color, ...(spec.detail ?? []), textField?.id, angleField?.id].filter((id): id is string => Boolean(id)).map(id => spec.instances[id]);
    // Dimensions on color and detail divide a pane into series; a measure on color does not.
    const seriesFields = encodingFields.filter(f => f.display === 'discrete' && f !== textField);
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
        const used = [...branchFields(pane.row.branch), ...branchFields(pane.column.branch), ...encodingFields];
        const dimensions = [...new Map(used.filter(f => !f.aggregate).map(f => [f.field, f])).values()];
        const described = [...new Map(used.map(f => [f.id, f])).values()];
        const describe = (f: FieldInstance, value: unknown) => `${f.label}: ${f.scale === 'time' ? (f.display === 'continuous' ? formatTime(fieldTime(f, value)) : memberLabel(f, value as Value)) : typeof value === 'number' && f.aggregate ? formatValue(value) : displayValue(value as Value)}`;
        const lengthAxis = valueAxis(xField, yField);
        const isLine = spec.mark === 'line';
        // A line runs along x unless x is the only value axis.
        const alongY = xContinuous && !yContinuous;
        const lines = new Map<string, { selected: boolean; points: { order: number; x: number; y: number; missing: boolean; color: string }[] }>();
        for (const mark of pane.marks) {
            // Points of a line outside the window still shape the visible segments.
            if (!isLine && (mark.row < r0 || mark.row >= r1 || mark.column < c0 || mark.column >= c1)) continue;
            const { record } = mark;
            const rowLeaf = rows.leaves[mark.row], columnLeaf = columns.leaves[mark.column];
            const xValue = xContinuous ? positionValue(xField!, record) : 0;
            const yValue = yContinuous ? positionValue(yField!, record) : 0;
            const missing = !Number.isFinite(xValue) || !Number.isFinite(yValue);
            const x = xContinuous ? px(columnLeaf, xValue) : sx(columnLeaf.offset + columnLeaf.size / 2);
            const y = yContinuous ? py(rowLeaf, yValue) : sy(rowLeaf.offset + rowLeaf.size / 2);
            const color = fill(record);
            // A box stands for all its records, so only its dimensions identify it.
            const keys = mark.box ? dimensions.filter(f => f.display === 'discrete') : dimensions;
            const id = JSON.stringify([pane.row.branch.order, pane.column.branch.order, ...keys.map(f => valueKey(record[f.field]))]);
            const selected = selecting && state.selected!.has(id);
            if (isLine) {
                const order = alongY ? (yContinuous ? y : mark.row) : (xContinuous ? x : mark.column);
                if (Number.isFinite(order)) {
                    const key = JSON.stringify(seriesFields.map(f => valueKey(record[f.field])));
                    const line = lines.get(key) ?? { selected: false, points: [] };
                    line.points.push({ order, x, y, missing, color });
                    line.selected ||= selected;
                    lines.set(key, line);
                }
            }
            if (missing) continue;
            const selection: Selection = { id, paneId: pane.id, rowPath: rowLeaf.path, columnPath: columnLeaf.path,
                predicates: keys.map(f => ({ field: f.field, value: record[f.field] as Value })), values: mark.box ? { ...record, ...mark.box } : record };
            const extra: Partial<Primitive> = { selection, tooltip: described.map(f => describe(f, record[resultKey(f)])).join('\n') };
            if (selecting && !selected) extra.opacity = dimmed;
            if (spec.mark === 'arc') {
                if (!Number.isFinite(mark.start)) continue;
                const radius = Math.max(4, Math.min(columnLeaf.size, rowLeaf.size) / 2 - 10);
                const share = `Share: ${formatValue((mark.end - mark.start) * 100)}%`;
                items.push({ kind: 'shape', layer: 'body', x, y, path: slice(radius, mark.start, mark.end), fill: color, stroke: ink.paper, strokeWidth: 1, ...extra, tooltip: `${extra.tooltip}\n${share}` });
            } else if (spec.mark === 'boxplot') {
                // The box sits in the member step across the value axis. Several colors share the step side by side.
                const flat = lengthAxis === 'x';
                const step = flat ? rowLeaf.size : columnLeaf.size;
                const [index, count] = mark.slot ?? [0, 1];
                const room = step * metrics.barFill / count;
                const thickness = Math.max(2, Math.min(28, room - (count > 1 ? 1 : 0)));
                const center = (flat ? y : x) + (index - (count - 1) / 2) * room;
                const at = (value: number) => flat ? px(columnLeaf, value) : py(rowLeaf, value);
                if (mark.outlier) {
                    items.push({ kind: 'symbol', layer: 'body', x: flat ? at(mark.start) : center, y: flat ? center : at(mark.start), size: 18, fill: 'transparent', stroke: color, strokeWidth: 1, ...extra });
                    continue;
                }
                const box = mark.box!, measure = flat ? xField! : yField!;
                const tooltip = [...keys.map(f => describe(f, record[f.field])), measure.label,
                    ...([['Upper whisker', box.high], ['Upper quartile', box.q3], ['Median', box.median], ['Lower quartile', box.q1], ['Lower whisker', box.low]] as const).map(([name, value]) => `${name}: ${formatValue(value)}`),
                    `Records: ${box.count}`].join('\n');
                // A stretch along the value axis, `across` px wide and at least `least` px long.
                const stretch = (from: number, to: number, across: number, color: string, least = 1) => {
                    const a = Math.min(at(from), at(to)), length = Math.max(least, Math.abs(at(to) - at(from)));
                    const start = Math.abs(at(to) - at(from)) < least ? a - least / 2 : a;
                    if (flat) rect('body', start, center - across / 2, length, across, color, { ...extra, tooltip });
                    else rect('body', center - across / 2, start, across, length, color, { ...extra, tooltip });
                };
                stretch(box.low, box.high, 1, color);
                stretch(box.low, box.low, thickness / 2, color);
                stretch(box.high, box.high, thickness / 2, color);
                // A box too short to hold a median line, as when it has a single record, is drawn as a dash.
                const short = Math.abs(at(box.q3) - at(box.q1)) < 4;
                stretch(box.q1, box.q3, thickness, color, short ? 2 : 1);
                if (!short) stretch(box.median, box.median, thickness, ink.paper, 2);
            } else if (spec.mark === 'tick') {
                // A tick is a short line across its value axis. Between two value axes it stands upright.
                const length = (leafSize: number, continuous: boolean) => continuous ? 14 : Math.max(3, leafSize * metrics.barFill);
                if (xContinuous) { const h = length(rowLeaf.size, yContinuous); rect('body', Math.round(x) - 1, y - h / 2, 2, h, color, extra); }
                else { const w = length(columnLeaf.size, false); rect('body', x - w / 2, Math.round(y) - 1, w, 2, color, extra); }
            } else if (spec.mark === 'bar') {
                if (!Number.isFinite(mark.start) || !Number.isFinite(mark.end)) continue;
                if (lengthAxis === 'x') {
                    const a = px(columnLeaf, mark.start), b = px(columnLeaf, mark.end), thickness = yContinuous ? barAt(rowLeaf) : Math.max(1, rowLeaf.size * metrics.barFill);
                    rect('body', Math.min(a, b), y - thickness / 2, Math.max(.5, Math.abs(b - a)), thickness, color, extra);
                } else {
                    const a = py(rowLeaf, mark.start), b = py(rowLeaf, mark.end), thickness = xContinuous ? barAt(columnLeaf) : Math.max(1, columnLeaf.size * metrics.barFill);
                    rect('body', x - thickness / 2, Math.min(a, b), thickness, Math.max(.5, Math.abs(b - a)), color, extra);
                }
            } else if (spec.mark === 'text') {
                // In a cell the number is written in full; along a value axis it is abbreviated like a tick.
                const f = textField ?? (xField?.aggregate ? xField : yField?.aggregate ? yField : undefined);
                const raw = f ? record[resultKey(f)] : undefined;
                const cell = !xContinuous && !yContinuous;
                const label = !f ? '•' : raw == null ? '' : typeof raw !== 'number' ? displayValue(raw as Value) : cell ? formatValue(raw) : formatTick(raw);
                text('body', x, y + 4, cell ? fitText(label, columnLeaf.size - 6) : label, { align: 'center', fill: colorField ? color : ink.text, ...extra });
            } else if (spec.mark === 'rect') {
                // A cell mark fills its member step; on a value axis it stays a small square.
                const width = xContinuous ? 10 : columnLeaf.size - 1, height = yContinuous ? 10 : rowLeaf.size - 1;
                rect('body', x - width / 2, y - height / 2, width, height, color, extra);
            } else if (spec.mark === 'point') {
                // Hollow, with a transparent fill so the inside still takes the pointer.
                items.push({ kind: 'symbol', layer: 'body', x, y, size: 44, fill: 'transparent', stroke: color, strokeWidth: 1.5, ...extra });
            } else {
                items.push({ kind: 'symbol', layer: 'body', x, y, size: isLine ? 22 : 44, fill: color, ...extra });
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
            // A line has one stroke. With a measure on color only its points are tinted.
            if (path) items.push({ kind: 'path', layer: 'body', x: 0, y: 0, path, stroke: model.colorScale ? ink.mark : points[0].color, ...(selecting && !selected ? { opacity: dimmed } : {}) });
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
            const label = memberLabel(spec.instances[span.part.instanceId], span.part.value);
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
        leaf.scale.ticks.forEach((tick, index) => {
            const y = Math.round(py(leaf, tick));
            if (y < top || y > axisY) return;
            rect('rowHeader', left - 4, y, 4, 1, ink.line);
            text('rowHeader', left - 7, y + 3.5, tickLabel(leaf, index), { align: 'right', fontSize: 10, fill: ink.muted });
        });
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
        if (frame.bottomHeaderHeight && level === columns.levels.length - 1) return bottomHeaders(spans, height, rotated);
        for (const span of spansIn(spans, c0, c1)) {
            const first = columns.leaves[span.start], last = columns.leaves[span.end - 1];
            const x0 = sx(first.offset), x1 = sx(last.offset + last.size);
            const label = memberLabel(spec.instances[span.part.instanceId], span.part.value);
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

    // ---- strip under the body: member names of the innermost column field, or the value axis
    function bottomHeaders(spans: typeof columns.levels[number], height: number, rotated: boolean) {
        for (const span of spansIn(spans, c0, c1)) {
            const leaf = columns.leaves[span.start];
            if (span.start % stride(leaf.size, rotated ? 12 : 1)) continue;
            const center = sx(leaf.offset + leaf.size / 2);
            if (center < left || center > bodyRight) continue;
            const label = memberLabel(spec.instances[span.part.instanceId], span.part.value);
            const tooltip = `${spec.instances[span.part.instanceId].label}: ${label}`;
            // Vertical names hang from the axis line and read upwards.
            if (rotated) text('xAxis', center + 4, axisY + 6, fitText(label, height - 8), { angle: 270, align: 'right', tooltip });
            else text('xAxis', center, axisY + 16, fitText(label, leaf.size - 4), { align: 'center', tooltip });
        }
    }
    if (frame.bottom) {
        rect('xAxis', left, axisY, viewport.width - left, frame.bottom, ink.paper);
        rect('xAxis', left, axisY, bodyRight - left, 1, ink.line);
        // Group dividers run on through the strip.
        if (frame.bottomHeaderHeight && c1 > c0) for (let g = columns.leaves[c0].group; g <= columns.leaves[c1 - 1].group; g++) {
            const x = sx(columns.groups[g].offset);
            if (x >= left && columns.groups[g].offset > 0) rect('xAxis', x, axisY, 1, frame.bottom, ink.line);
        }
        for (let i = c0; i < c1; i++) {
            const leaf = columns.leaves[i];
            if (!leaf.scale) continue;
            const s0 = sx(leaf.offset), s1 = s0 + leaf.size;
            if (s0 >= left && leaf.offset > 0) rect('xAxis', s0, axisY, 1, frame.bottom, ink.line);
            leaf.scale.ticks.forEach((tick, index) => {
                const x = Math.round(px(leaf, tick));
                if (x < left || x > bodyRight) return;
                const label = tickLabel(leaf, index);
                const half = textWidth(label, 10) / 2;
                rect('xAxis', x, axisY, 1, 4, ink.line);
                text('xAxis', x, axisY + 15, label, { align: x - half < s0 + 2 ? 'left' : x + half > s1 - 2 ? 'right' : 'center', fontSize: 10, fill: ink.muted });
            });
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

    // ---- legend, right after the body or on the window edge when the sheet is wider
    if (right && colorField) {
        const x = bodyRight, inner = right - 24;
        rect('legend', x, 0, Math.max(right, viewport.width - x), viewport.height, ink.paper);
        rect('legend', x, 0, 1, Math.min(viewport.height, axisY + frame.bottom), ink.line);
        text('legend', x + 12, 17, fitText(colorField.label, inner, metrics.fontSize, 600), { fontWeight: 600, tooltip: colorField.label });
        if (model.colorScale) {
            const [low, high] = model.colorScale.domain, steps = 40;
            for (let i = 0; i < steps; i++) rect('legend', x + 12 + i * inner / steps, 28, inner / steps + .5, 10, continuousColor(model.colorScale, low + (high - low) * (i + .5) / steps, ink, cells));
            text('legend', x + 12, 52, formatTick(low), { fontSize: 10, fill: ink.muted });
            text('legend', x + 12 + inner, 52, formatTick(high), { fontSize: 10, fill: ink.muted, align: 'right' });
        } else {
            // A list longer than the window ends with a count instead of running off it.
            const room = Math.max(1, Math.floor((viewport.height - 30) / 18));
            const shown = model.colors.length > room ? room - 1 : model.colors.length;
            model.colors.slice(0, shown).forEach((value, i) => {
                rect('legend', x + 12, 28 + i * 18, 10, 10, ink.category[i % ink.category.length]);
                text('legend', x + 28, 37 + i * 18, fitText(memberLabel(colorField, value), inner - 16), { tooltip: memberLabel(colorField, value) });
            });
            if (shown < model.colors.length) text('legend', x + 12, 37 + shown * 18, `+${model.colors.length - shown} more`, { fill: ink.muted });
        }
    }
    return { width: viewport.width, height: viewport.height, items, visiblePanes, background: ink.paper, legend: !colorField ? 'none' : right ? 'side' : 'omitted' };
}
