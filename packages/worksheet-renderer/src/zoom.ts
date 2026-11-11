import type { Box } from './clip';
import { leafRange, metrics } from './layout';
import type { Zoom } from './model';
import type { Viewport } from './scene';
import type { AxisLeaf, WorksheetModel } from './types';
import { warp } from './warp';

/** The continuous axes under a point of the window, each with how far along its range the point is, from 0 to 1. */
export interface AxesAt { x?: { leaf: AxisLeaf; t: number }; y?: { leaf: AxisLeaf; t: number } }

const inner = (leaf: AxisLeaf) => leaf.size - metrics.scalePadStart - metrics.scalePadEnd;

/**
 * What a pointer at window position (px, py) can zoom: the value axes of the pane it is over.
 * Nothing outside the body, and nothing in a pane without a value axis, such as a table of text.
 */
export function axesAt(model: WorksheetModel, body: Box, viewport: Viewport, px: number, py: number): AxesAt {
    if (px < body.x0 || px >= body.x1 || py < body.y0 || py >= body.y1) return {};
    const lx = px - model.frame.left + viewport.x, ly = py - model.frame.top + viewport.y;
    const column = model.columns.leaves[leafRange(model.columns, lx, lx + 1e-6)[0]];
    const row = model.rows.leaves[leafRange(model.rows, ly, ly + 1e-6)[0]];
    const found: AxesAt = {};
    if (column?.scale?.key) found.x = { leaf: column, t: (lx - column.offset - metrics.scalePadStart) / inner(column) };
    // Values grow upwards.
    if (row?.scale?.key) found.y = { leaf: row, t: (row.offset + row.size - ly - metrics.scalePadStart) / inner(row) };
    return found;
}

// How far in and out an axis can go, as multiples of the range the data asks for.
const closest = 1e-4, widest = 20;

/** The range after zooming `from` by `factor` around the point at share `t` of it. Below 1 zooms in. */
export function zoomed(leaf: AxisLeaf, from: readonly [number, number], t: number, factor: number): [number, number] {
    // On an axis that is not linear the zoom works where its values are spread evenly, so the point under the pointer stays put.
    const { to, from: back } = warp(leaf.scale!.type);
    const low = to(from[0]), high = to(from[1]), [fullLow, fullHigh] = (leaf.scale!.full ?? leaf.scale!.domain).map(to);
    const span = high - low, whole = fullHigh - fullLow;
    const next = Math.min(whole * widest, Math.max(whole * closest, span * factor));
    const at = low + span * t;
    return [back(at - next * t), back(at + next * (1 - t))];
}
/** The range after moving the axis by `pixels` on screen, in the direction its values grow. */
export function panned(leaf: AxisLeaf, from: readonly [number, number], pixels: number): [number, number] {
    const { to, from: back } = warp(leaf.scale!.type);
    const low = to(from[0]), high = to(from[1]), shift = -pixels / inner(leaf) * (high - low);
    return [back(low + shift), back(high + shift)];
}
/** `zoom` with the range of one axis replaced. Returning to the range the data asks for drops the entry. */
export function withRange(zoom: Zoom, leaf: AxisLeaf, range: [number, number]): Zoom {
    const { key, full } = leaf.scale!;
    const next = { ...zoom };
    if (full && Math.abs(range[0] - full[0]) < 1e-9 * Math.abs(full[1] - full[0]) && Math.abs(range[1] - full[1]) < 1e-9 * Math.abs(full[1] - full[0])) delete next[key!];
    else next[key!] = range;
    return next;
}
