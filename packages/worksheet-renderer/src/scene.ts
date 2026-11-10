import { continuousColor, fillOf, lightTheme, rgb, type Theme } from './color';
import { legendTitleHeight, level, memberIndex, opacityAt, pointArea, shapes, thicknessShare } from './channels';
import { displayValue, valueKey } from './keys';
import { branchFields, valueAxis } from './compiler';
import { stackMode } from './model';
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
    /** Outline of a symbol. A circle when absent. */
    symbol?: string;
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
    // On other marks the text field is a label next to the mark. A box stands for many records and gets none.
    const labelField = spec.mark !== 'text' && spec.mark !== 'boxplot' && spec.text ? spec.instances[spec.text] : undefined;
    const angleField = spec.mark === 'arc' && spec.angle ? spec.instances[spec.angle] : undefined;
    const { size: sizeScale, opacity: opacityScale, shape: shapeScale } = model.channels;
    const encodingFields = [...new Set([spec.color, ...(spec.detail ?? []), spec.text, angleField?.id, spec.size, spec.opacity, spec.shape].filter((id): id is string => Boolean(id)))].map(id => spec.instances[id]);
    // Dimensions on color, detail and the other channels divide a pane into series; a measure does not.
    const seriesFields = encodingFields.filter(f => f.display === 'discrete' && f !== textField);
    // Label boxes already written, so that a later label does not run into them.
    const written: [number, number, number, number][] = [];
    // White on a dark fill, dark on a light one.
    const inkOn = (fill: string) => { const [r, g, b] = rgb(fill); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.55 ? '#ffffff' : '#1f2937'; };
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
        const isLine = spec.mark === 'line', isArea = spec.mark === 'area', joined = isLine || isArea;
        // A line runs along x unless x is the only value axis. An area runs across its value axis.
        const alongY = isArea ? lengthAxis === 'x' : xContinuous && !yContinuous;
        // x and y are where the mark is; for an area that is its upper edge, and bx and by its lower edge.
        const lines = new Map<string, { selected: boolean; points: { order: number; x: number; y: number; bx: number; by: number; missing: boolean; color: string; size: number; alpha: number }[] }>();
        const box = { x0: sx(pane.column.offset), x1: sx(pane.column.offset + pane.column.size), y0: sy(pane.row.offset), y1: sy(pane.row.offset + pane.row.size) };
        type Spot = { x: number; y: number; align: 'left' | 'center' | 'right'; fill?: string };
        // Writes a label at the first spot that lies inside its pane and clear of the labels already written.
        const write = (value: string, width: number, spots: (Spot | false)[]) => {
            for (const spot of spots) {
                if (!spot) continue;
                const x0 = spot.align === 'left' ? spot.x : spot.align === 'right' ? spot.x - width : spot.x - width / 2;
                const next: [number, number, number, number] = [x0, spot.y - 10, x0 + width, spot.y + 2];
                if (next[0] < box.x0 + 1 || next[2] > box.x1 - 1 || next[1] < box.y0 || next[3] > box.y1) continue;
                if (written.some(w => next[0] < w[2] && next[2] > w[0] && next[1] < w[3] && next[3] > w[1])) continue;
                written.push(next);
                // Labels outside the window take their place all the same, so scrolling does not reshuffle them.
                if (next[2] >= left && next[0] <= bodyRight && next[3] >= top && next[1] <= axisY) text('body', spot.x, spot.y, value, { align: spot.align, fontSize: 10, fill: spot.fill ?? ink.text });
                return;
            }
        };
        const labelOf = (record: Record<string, unknown>) => {
            const raw = record[resultKey(labelField!)];
            if (raw == null) return '';
            if (labelField!.scale === 'time') return labelField!.display === 'continuous' ? formatTime(fieldTime(labelField!, raw)) : memberLabel(labelField!, raw as Value);
            return typeof raw === 'number' ? formatValue(raw) : displayValue(raw as Value);
        };
        for (const mark of pane.marks) {
            // Points of a line outside the window still shape the visible segments.
            if (!joined && (mark.row < r0 || mark.row >= r1 || mark.column < c0 || mark.column >= c1)) continue;
            const { record } = mark;
            const rowLeaf = rows.leaves[mark.row], columnLeaf = columns.leaves[mark.column];
            const xValue = xContinuous ? positionValue(xField!, record) : 0;
            const yValue = yContinuous ? positionValue(yField!, record) : 0;
            let missing = !Number.isFinite(xValue) || !Number.isFinite(yValue);
            let x = xContinuous ? px(columnLeaf, xValue) : sx(columnLeaf.offset + columnLeaf.size / 2);
            let y = yContinuous ? py(rowLeaf, yValue) : sy(rowLeaf.offset + rowLeaf.size / 2);
            let bx = x, by = y;
            if (isArea) {
                // The edges are where the mark's interval starts and ends, which under a stack is not its own value.
                missing ||= !Number.isFinite(mark.start) || !Number.isFinite(mark.end);
                if (lengthAxis === 'x') { bx = px(columnLeaf, mark.start); x = px(columnLeaf, mark.end); }
                else { by = py(rowLeaf, mark.start); y = py(rowLeaf, mark.end); }
            }
            const color = fill(record);
            // Where the record sits on size and opacity. Without a value there it keeps the default look.
            const sizeLevel = sizeScale ? level(sizeScale, record, true) : NaN;
            const sized = Number.isFinite(sizeLevel);
            const opacityLevel = opacityScale ? level(opacityScale, record) : NaN;
            const alpha = Number.isFinite(opacityLevel) ? opacityAt(opacityLevel) : 1;
            const shapeIndex = shapeScale ? memberIndex(shapeScale, record[shapeScale.field.field] as Value) : -1;
            const symbol = shapeIndex < 0 ? undefined : shapes[shapeIndex % shapes.length];
            const label = labelField && !mark.outlier ? labelOf(record) : '';
            const labelWidth = label ? textWidth(label, 10) : 0;
            // A box stands for all its records, so only its dimensions identify it.
            const keys = mark.box ? dimensions.filter(f => f.display === 'discrete') : dimensions;
            const id = JSON.stringify([pane.row.branch.order, pane.column.branch.order, ...keys.map(f => valueKey(record[f.field]))]);
            const selected = selecting && state.selected!.has(id);
            if (joined) {
                const order = alongY ? (yContinuous ? y : mark.row) : (xContinuous ? x : mark.column);
                if (Number.isFinite(order)) {
                    const key = JSON.stringify(seriesFields.map(f => valueKey(record[f.field])));
                    const line = lines.get(key) ?? { selected: false, points: [] };
                    line.points.push({ order, x, y, bx, by, missing, color, size: sizeLevel, alpha });
                    line.selected ||= selected;
                    lines.set(key, line);
                }
            }
            if (missing) continue;
            const selection: Selection = { id, paneId: pane.id, rowPath: rowLeaf.path, columnPath: columnLeaf.path,
                predicates: keys.map(f => ({ field: f.field, value: record[f.field] as Value })), values: mark.box ? { ...record, ...mark.box } : record };
            const extra: Partial<Primitive> = { selection, tooltip: described.map(f => describe(f, record[resultKey(f)])).join('\n') };
            if (mark.share !== undefined) extra.tooltip += `\nShare: ${formatValue(mark.share * 100)}%`;
            const fade = alpha * (selecting && !selected ? dimmed : 1);
            if (fade < 1) extra.opacity = fade;
            if (spec.mark === 'arc') {
                if (!Number.isFinite(mark.start)) continue;
                const radius = Math.max(4, Math.min(columnLeaf.size, rowLeaf.size) / 2 - 10);
                const share = `Share: ${formatValue((mark.end - mark.start) * 100)}%`;
                items.push({ kind: 'shape', layer: 'body', x, y, path: slice(radius, mark.start, mark.end), fill: color, stroke: ink.paper, strokeWidth: 1, ...extra, tooltip: `${extra.tooltip}\n${share}` });
                // Inside the slice, where it is wide enough to hold the text.
                const middle = (mark.start + mark.end) * Math.PI;
                if (label && mark.end - mark.start >= 0.05) write(label, labelWidth, [{ x: x + Math.sin(middle) * radius * 0.62, y: y - Math.cos(middle) * radius * 0.62 + 4, align: 'center', fill: inkOn(color) }]);
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
                const length = (leafSize: number, continuous: boolean) => (continuous ? 14 : Math.max(3, leafSize * metrics.barFill)) * (sized ? thicknessShare(sizeLevel) : 1);
                if (xContinuous) { const h = length(rowLeaf.size, yContinuous); rect('body', Math.round(x) - 1, y - h / 2, 2, h, color, extra); }
                else { const w = length(columnLeaf.size, false); rect('body', x - w / 2, Math.round(y) - 1, w, 2, color, extra); }
                if (label) write(label, labelWidth, xContinuous ? [{ x: x + 5, y: y + 4, align: 'left' }, { x: x - 5, y: y + 4, align: 'right' }] : [{ x, y: y - 5, align: 'center' }, { x, y: y + 14, align: 'center' }]);
            } else if (spec.mark === 'bar') {
                if (!Number.isFinite(mark.start) || !Number.isFinite(mark.end)) continue;
                const slim = sized ? thicknessShare(sizeLevel) : 1;
                // A bar that is one of several in a pile is labelled inside, where the label cannot be taken for a
                // neighbour's. A bar on its own is labelled past its end, or just inside the end when there is no room.
                const piled = Boolean(stackMode(model.plan)) && seriesFields.length > 0;
                const forward = mark.end >= mark.start;
                if (lengthAxis === 'x') {
                    const a = px(columnLeaf, mark.start), b = px(columnLeaf, mark.end), thickness = (yContinuous ? barAt(rowLeaf) : Math.max(1, rowLeaf.size * metrics.barFill)) * slim;
                    rect('body', Math.min(a, b), y - thickness / 2, Math.max(.5, Math.abs(b - a)), thickness, color, extra);
                    const end = forward ? Math.max(a, b) : Math.min(a, b), out = forward ? 1 : -1, fits = Math.abs(b - a) >= labelWidth + 8 && thickness >= 11;
                    if (label) write(label, labelWidth, piled ? [fits && { x: (a + b) / 2, y: y + 4, align: 'center', fill: inkOn(color) }]
                        : [{ x: end + out * 4, y: y + 4, align: forward ? 'left' : 'right' }, fits && { x: end - out * 4, y: y + 4, align: forward ? 'right' : 'left', fill: inkOn(color) }]);
                } else {
                    const a = py(rowLeaf, mark.start), b = py(rowLeaf, mark.end), thickness = (xContinuous ? barAt(columnLeaf) : Math.max(1, columnLeaf.size * metrics.barFill)) * slim;
                    rect('body', x - thickness / 2, Math.min(a, b), thickness, Math.max(.5, Math.abs(b - a)), color, extra);
                    const end = forward ? Math.min(a, b) : Math.max(a, b), fits = Math.abs(b - a) >= 14 && thickness >= labelWidth + 2;
                    if (label) write(label, labelWidth, piled ? [fits && { x, y: (a + b) / 2 + 4, align: 'center', fill: inkOn(color) }]
                        : [{ x, y: forward ? end - 4 : end + 12, align: 'center' }, fits && { x, y: forward ? end + 12 : end - 4, align: 'center', fill: inkOn(color) }]);
                }
            } else if (spec.mark === 'text') {
                // In a cell the number is written in full; along a value axis it is abbreviated like a tick.
                const f = textField ?? (xField?.aggregate ? xField : yField?.aggregate ? yField : undefined);
                const raw = f ? record[resultKey(f)] : undefined;
                const cell = !xContinuous && !yContinuous;
                const shown = !f ? '•' : raw == null ? '' : typeof raw !== 'number' ? displayValue(raw as Value) : cell ? formatValue(raw) : formatTick(raw);
                const fontSize = sized ? Math.round(9 + 15 * sizeLevel) : metrics.fontSize;
                text('body', x, y + fontSize * 0.36, cell ? fitText(shown, columnLeaf.size - 6, fontSize) : shown, { align: 'center', fill: colorField ? color : ink.text, fontSize, ...extra });
            } else if (spec.mark === 'rect') {
                // A cell mark fills its member step; on a value axis it stays a small square.
                // Sized cells keep their place in the grid and shrink towards their center.
                const share = sized ? 0.3 + 0.7 * sizeLevel : 1;
                const width = (xContinuous ? 10 : columnLeaf.size - 1) * share, height = (yContinuous ? 10 : rowLeaf.size - 1) * share;
                rect('body', x - width / 2, y - height / 2, width, height, color, extra);
                if (label) write(label, labelWidth, [width >= labelWidth + 4 && height >= 12 && { x, y: y + 4, align: 'center', fill: inkOn(color) }]);
            } else if (isArea) {
                // The area itself is drawn per series below. Each of its points keeps an unseen spot on the
                // upper edge that answers the pointer.
                items.push({ kind: 'symbol', layer: 'body', x, y, size: 64, fill: 'transparent', ...extra, opacity: undefined });
                if (label) write(label, labelWidth, [{ x, y: y - 6, align: 'center' }]);
            } else if (isLine) {
                items.push({ kind: 'symbol', layer: 'body', x, y, size: 22, fill: color, ...extra });
                if (label) write(label, labelWidth, [{ x, y: y - 7, align: 'center' }, { x, y: y + 15, align: 'center' }]);
            } else {
                const area = sized ? pointArea(sizeLevel) : 44, reach = Math.sqrt(area / Math.PI) + 3;
                // A point is hollow, with a transparent fill so the inside still takes the pointer. A circle is filled.
                items.push(spec.mark === 'point' ? { kind: 'symbol', layer: 'body', x, y, size: area, symbol, fill: 'transparent', stroke: color, strokeWidth: 1.5, ...extra }
                    : { kind: 'symbol', layer: 'body', x, y, size: area, symbol, fill: color, ...extra });
                if (label) write(label, labelWidth, [{ x: x + reach, y: y + 4, align: 'left' }, { x, y: y - reach - 1, align: 'center' }, { x: x - reach, y: y + 4, align: 'right' }]);
            }
        }
        // Areas that pile up do not cover each other and can be solid; areas that overlap must let the others show through.
        const areaOpacity = stackMode(model.plan) ? 0.85 : 0.5;
        for (const { points, selected } of lines.values()) {
            points.sort((a, b) => a.order - b.order);
            // A missing value ends the current segment; the next valid point starts a new one.
            type Point = typeof points[number];
            const segments: Point[][] = [];
            let open: Point[] | undefined;
            for (const point of points) {
                if (point.missing) { open = undefined; continue; }
                if (!open) segments.push(open = []);
                open.push(point);
            }
            if (!segments.length) continue;
            // A line or an area has one color. With a measure on color only its points are tinted.
            const color = model.colorScale ? ink.mark : points[0].color;
            // It has one width and one opacity too: the average over its points, which for a dimension is the member's own.
            const drawn = segments.flat();
            const mean = (values: number[]) => { const finite = values.filter(Number.isFinite); return finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : NaN; };
            const sizeLevel = mean(drawn.map(p => p.size));
            const faded = (selecting && !selected ? dimmed : 1) * (mean(drawn.map(p => p.alpha)) || 1);
            const at = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
            if (isArea) for (const segment of segments) {
                const [only] = segment;
                // One point has no extent along the axis, so it is drawn as a thin bar from edge to edge.
                if (segment.length === 1) rect('body', Math.min(only.x, only.bx) - (alongY ? 0 : 1.5), Math.min(only.y, only.by) - (alongY ? 1.5 : 0),
                    alongY ? Math.max(1, Math.abs(only.x - only.bx)) : 3, alongY ? 3 : Math.max(1, Math.abs(only.y - only.by)), color, { opacity: faded * areaOpacity });
                // Out along the upper edge and back along the lower one.
                else items.push({ kind: 'shape', layer: 'body', x: 0, y: 0, fill: color, opacity: faded * areaOpacity,
                    path: `M${segment.map(p => at(p.x, p.y)).join('L')}L${[...segment].reverse().map(p => at(p.bx, p.by)).join('L')}Z` });
            }
            items.push({ kind: 'path', layer: 'body', x: 0, y: 0, path: segments.map(segment => `M${segment.map(p => at(p.x, p.y)).join('L')}`).join(' '), stroke: color,
                ...(isLine && Number.isFinite(sizeLevel) ? { strokeWidth: 1 + 5 * sizeLevel } : {}), ...(faded < 1 ? { opacity: faded } : {}) });
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
    if (right && model.legends.length) {
        const x = bodyRight, inner = right - 24;
        rect('legend', x, 0, Math.max(right, viewport.width - x), viewport.height, ink.paper);
        rect('legend', x, 0, 1, Math.min(viewport.height, axisY + frame.bottom), ink.line);
        // One block per channel, top to bottom. A block that does not fit whole ends with a count; one
        // that has no room for a single row is left out.
        let y = 0;
        for (const block of model.legends) {
            const room = viewport.height - y - legendTitleHeight - 2;
            if (block.kind === 'ramp' ? room < 36 : room < block.step) break;
            text('legend', x + 12, y + 17, fitText(block.title, inner, metrics.fontSize, 600), { fontWeight: 600, tooltip: block.title });
            if (block.kind === 'ramp' && model.colorScale) {
                const [low, high] = model.colorScale.domain, steps = 40;
                for (let i = 0; i < steps; i++) rect('legend', x + 12 + i * inner / steps, y + 28, inner / steps + .5, 10, continuousColor(model.colorScale, low + (high - low) * (i + .5) / steps, ink, cells));
                text('legend', x + 12, y + 52, block.entries[0].label, { fontSize: 10, fill: ink.muted });
                text('legend', x + 12 + inner, y + 52, block.entries[1].label, { fontSize: 10, fill: ink.muted, align: 'right' });
                y += block.height;
                continue;
            }
            const rows = Math.max(1, Math.floor(room / block.step));
            const shown = block.entries.length > rows ? rows - 1 : block.entries.length;
            const gutter = block.channel === 'size' ? 24 : 16;
            block.entries.slice(0, shown).forEach((entry, i) => {
                const middle = y + legendTitleHeight + i * block.step + block.step / 2 - 4;
                if (block.channel === 'color') rect('legend', x + 12, middle - 5, 10, 10, ink.category[entry.level % ink.category.length]);
                // Sizes are drawn as circles whatever the mark, small enough for a row.
                else if (block.channel === 'size') items.push({ kind: 'symbol', layer: 'legend', x: x + 21, y: middle, size: (4 + 14 * entry.level) ** 2 * Math.PI / 4, fill: ink.muted });
                else if (block.channel === 'opacity') rect('legend', x + 12, middle - 5, 10, 10, colorField ? ink.text : ink.mark, { opacity: opacityAt(entry.level) });
                else items.push({ kind: 'symbol', layer: 'legend', x: x + 17, y: middle, size: 60, symbol: shapes[entry.level % shapes.length], ...(spec.mark === 'point' ? { fill: 'transparent', stroke: ink.text, strokeWidth: 1.5 } : { fill: ink.text }) });
                text('legend', x + 12 + gutter, middle + 4, fitText(entry.label, inner - gutter), { tooltip: entry.label });
            });
            if (shown < block.entries.length) text('legend', x + 12, y + legendTitleHeight + shown * block.step + block.step / 2, `+${block.entries.length - shown} more`, { fill: ink.muted });
            y += legendTitleHeight + Math.min(block.entries.length, shown + (shown < block.entries.length ? 1 : 0)) * block.step + 6;
        }
    }
    return { width: viewport.width, height: viewport.height, items, visiblePanes, background: ink.paper, legend: !model.legends.length ? 'none' : right ? 'side' : 'omitted' };
}
