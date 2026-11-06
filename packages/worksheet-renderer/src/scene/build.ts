import type { AxisWindow, DomainBatch, PaneBatch, RenderPlan, ResultBinding } from '../core/types';
import type { Box, Primitive, SceneFrame } from './types';
import { advanceBarStack } from '../core/prepared';
import { resolveDomainValues } from './scales';

export interface LayoutMetrics {
    rowHeight: number;
    columnWidth: number;
    headerWidth: number;
    headerHeight: number;
}
export function layoutMetrics(plan: RenderPlan, width: number): LayoutMetrics {
    return {
        rowHeight: 180,
        columnWidth: 240,
        headerWidth: Math.min(
            Math.max(112, (plan.rows.facets.length + (plan.rows.positions.length > 1 ? 1 : 0)) * 78),
            Math.max(112, width * 0.35),
        ),
        headerHeight: Math.max(40, plan.columns.facets.length * 28 + 26),
    };
}
const key = (v: unknown) => `${typeof v}:${JSON.stringify(v)}`;
const numberLabel = (n: number) => Number(n.toPrecision(4)).toLocaleString('en-US');
export interface SceneInput {
    plan: RenderPlan;
    rows: AxisWindow;
    columns: AxisWindow;
    panes: PaneBatch;
    domains: DomainBatch;
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    frameId: number;
    selected?: ReadonlySet<string>;
}
export function buildScene(input: SceneInput): SceneFrame {
    const { plan, width, height, scrollX, scrollY, rows, columns, domains, panes } = input;
    const m = layoutMetrics(plan, width),
        all: Box = { x: 0, y: 0, width, height };
    const body: Box = {
        x: m.headerWidth,
        y: m.headerHeight,
        width: Math.max(0, width - m.headerWidth),
        height: Math.max(0, height - m.headerHeight),
    };
    const frame: SceneFrame = {
        frameId: input.frameId,
        width,
        height,
        commands: [],
        hits: [],
        rowStart: rows.range.start,
        columnStart: columns.range.start,
    };
    const add = (id: string, clip: Box, primitive: Primitive) => frame.commands.push({ id, clip, primitive });
    const rect = (id: string, clip: Box, box: Box, fill: string, stroke?: string) => add(id, clip, { kind: 'rect', box, fill, stroke });
    const text = (id: string, clip: Box, x: number, y: number, label: string, align: 'left' | 'center' | 'right' = 'left') =>
        add(id, clip, { kind: 'text', x, y, text: label, fill: '#334155', size: 11, align });
    const bindings = new Map(plan.bindings.map((b) => [b.fieldRef, b]));
    const resolvedDomains = new Map<string, readonly unknown[]>();
    const effectiveDomain = (binding: ResultBinding) => {
        let values = resolvedDomains.get(binding.fieldRef);
        if (!values) {
            const domain = domains.domains[binding.fieldRef];
            values = domain ? resolveDomainValues(domain, plan.scales?.[binding.fieldRef]) : [];
            resolvedDomains.set(binding.fieldRef, values);
        }
        return values;
    };
    const intersect = (a: Box, b: Box): Box => ({
        x: Math.max(a.x, b.x),
        y: Math.max(a.y, b.y),
        width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)),
        height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)),
    });
    const lookup = new Map(panes.panes.map((p) => [`${p.rowRank}:${p.columnRank}`, p]));
    rect('background', all, all, plan.style?.background ?? '#fff');
    const scale = (binding: ResultBinding | undefined, value: unknown, start: number, end: number): number => {
        if (!binding) return (start + end) / 2;
        const domain = domains.domains[binding.fieldRef];
        if (!domain || !domain.complete || domain.source === 'unavailable') return NaN;
        const reverse = plan.scales?.[binding.fieldRef]?.reverse;
        const [a, b] = reverse ? [end, start] : [start, end];
        if (domain.type === 'band') {
            const values = effectiveDomain(binding);
            const rank = values.findIndex((v) => key(v) === key(value));
            return rank < 0 ? NaN : a + ((rank + 0.5) / Math.max(1, values.length)) * (b - a);
        }
        if (value === null || typeof value !== 'number' || !Number.isFinite(value)) return NaN;
        const extent = effectiveDomain(binding);
        const lo = Number(extent[0]),
            hi = Number(extent[1]);
        return a + ((value - lo) / (hi - lo || 1)) * (b - a);
    };
    for (const row of rows.leaves)
        for (const col of columns.leaves) {
            const left = m.headerWidth + col.rank * m.columnWidth - scrollX,
                top = m.headerHeight + row.rank * m.rowHeight - scrollY;
            const cell: Box = { x: left, y: top, width: m.columnWidth, height: m.rowHeight };
            const clip = intersect(body, cell);
            if (!clip.width || !clip.height) continue;
            const id = `${row.key}:${col.key}`,
                pane = lookup.get(`${row.rank}:${col.rank}`);
            rect(`cell:${id}`, clip, cell, '#fff', '#e2e8f0');
            const plot: Box = { x: left + 48, y: top + 22, width: m.columnWidth - 60, height: m.rowHeight - 52 };
            const plotClip = intersect(clip, plot);
            const xb = bindings.get(col.positionRef ?? ''),
                yb = bindings.get(row.positionRef ?? '');
            const covered = panes.coveredWindows.some(
                (w) => row.rank >= w.rows.start && row.rank < w.rows.end && col.rank >= w.columns.start && col.rank < w.columns.end,
            );
            if (!covered || (pane && !pane.complete)) {
                text(`loading:${id}`, clip, left + 60, top + 60, 'Loading…');
                continue;
            }
            for (const [binding, vertical] of [
                [xb, false],
                [yb, true],
            ] as const) {
                if (!binding) continue;
                const domain = domains.domains[binding.fieldRef];
                if (!domain) continue;
                const extent = effectiveDomain(binding);
                const labels = domain.type === 'band' ? extent : [extent[0], (Number(extent[0]) + Number(extent[1])) / 2, extent[1]];
                const stride = Math.max(1, Math.ceil(labels.length / 10));
                labels.forEach((value, index) => {
                    if (index % stride) return;
                    const at = scale(binding, value, vertical ? plot.y + plot.height : plot.x, vertical ? plot.y : plot.x + plot.width);
                    if (!Number.isFinite(at)) return;
                    const label =
                        domain.type === 'time'
                            ? new Date(Number(value)).toISOString().slice(0, 10)
                            : typeof value === 'number'
                              ? numberLabel(value)
                              : String(value ?? '∅');
                    if (vertical) text(`y:${id}:${index}`, clip, plot.x - 5, at + 4, label.slice(0, 16), 'right');
                    else text(`x:${id}:${index}`, clip, at, plot.y + plot.height + 16, label.slice(0, 16), 'center');
                });
            }
            text(`title:${id}`, clip, left + 52, top + 14, [yb?.label, xb?.label].filter(Boolean).join(' / ').slice(0, 32));
            const stacks = new Map<string, { positive: number; negative: number }>();
            for (const record of pane?.records ?? []) {
                const xv = xb ? record.values[xb.columnKey] : undefined,
                    yv = yb ? record.values[yb.columnKey] : undefined;
                let x = scale(xb, xv, plot.x, plot.x + plot.width),
                    y = scale(yb, yv, plot.y + plot.height, plot.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                let color = plan.style?.color ?? '#2563eb';
                const colorChannel = plan.channels?.color;
                if (colorChannel && 'value' in colorChannel) color = String(colorChannel.value);
                if (colorChannel && 'fieldRef' in colorChannel) {
                    const cb = bindings.get(colorChannel.fieldRef)!;
                    const values = effectiveDomain(cb);
                    const ordinal = values.findIndex((v) => key(v) === key(record.values[cb.columnKey]));
                    const palette = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#dc2626', '#0891b2'];
                    color = palette[Math.max(0, ordinal) % palette.length];
                }
                const markId = `${pane!.key}:${record.datumKey}`;
                if (input.selected?.has(markId)) color = '#ea580c';
                let bounds: Box;
                if (plan.mark === 'point') {
                    const radius = 4;
                    add(markId, plotClip, { kind: 'circle', x, y, radius, fill: color });
                    bounds = { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 };
                } else {
                    const horizontal = plan.barOrientation === 'horizontal' || yb?.positionType === 'band';
                    const valueBinding = horizontal ? xb : yb,
                        bandBinding = horizontal ? yb : xb;
                    const value = horizontal ? xv : yv,
                        category = horizontal ? yv : xv;
                    if (!valueBinding || typeof value !== 'number') continue;
                    const { start, end } = plan.stack === 'zero' ? advanceBarStack(stacks, category, value) : { start: 0, end: value };
                    const pixelStart = scale(
                        valueBinding,
                        start,
                        horizontal ? plot.x : plot.y + plot.height,
                        horizontal ? plot.x + plot.width : plot.y,
                    );
                    const pixelEnd = scale(
                        valueBinding,
                        end,
                        horizontal ? plot.x : plot.y + plot.height,
                        horizontal ? plot.x + plot.width : plot.y,
                    );
                    const bandCount = bandBinding ? effectiveDomain(bandBinding).length : 1;
                    const thickness =
                        bandBinding?.positionType === 'band'
                            ? Math.max(1, ((horizontal ? plot.height : plot.width) / Math.max(1, bandCount)) * 0.72)
                            : 8;
                    bounds = horizontal
                        ? {
                              x: Math.min(pixelStart, pixelEnd),
                              y: y - thickness / 2,
                              width: Math.abs(pixelEnd - pixelStart),
                              height: thickness,
                          }
                        : {
                              x: x - thickness / 2,
                              y: Math.min(pixelStart, pixelEnd),
                              width: thickness,
                              height: Math.abs(pixelEnd - pixelStart),
                          };
                    rect(markId, plotClip, bounds, color);
                }
                frame.hits.push({
                    id: markId,
                    paneKey: pane!.key,
                    datumKey: record.datumKey,
                    box: bounds,
                    clip: plotClip,
                    values: record.values,
                });
            }
        }
    const rowClip: Box = { x: 0, y: m.headerHeight, width: m.headerWidth, height: Math.max(0, height - m.headerHeight) };
    const colClip: Box = { x: m.headerWidth, y: 0, width: Math.max(0, width - m.headerWidth), height: m.headerHeight };
    rect('row-background', rowClip, rowClip, '#f8fafc');
    rect('column-background', colClip, colClip, '#f8fafc');
    const rowDepth = Math.max(1, plan.rows.facets.length + (plan.rows.positions.length > 1 ? 1 : 0)),
        rowLevelWidth = m.headerWidth / rowDepth;
    for (const span of rows.ancestors) {
        const box = {
            x: span.depth * rowLevelWidth,
            y: m.headerHeight + span.start * m.rowHeight - scrollY,
            width: rowLevelWidth,
            height: (span.end - span.start) * m.rowHeight,
        };
        const clip = intersect(rowClip, box);
        rect(`rh:${span.key}`, clip, box, '#f8fafc', '#cbd5e1');
        text(
            `rht:${span.key}`,
            clip,
            box.x + 5,
            Math.max(box.y, clip.y) + 17,
            span.label.slice(0, Math.max(2, Math.floor(rowLevelWidth / 7))),
        );
    }
    for (const span of columns.ancestors) {
        const box = {
            x: m.headerWidth + span.start * m.columnWidth - scrollX,
            y: span.depth * 28,
            width: (span.end - span.start) * m.columnWidth,
            height: 28,
        };
        const clip = intersect(colClip, box);
        rect(`ch:${span.key}`, clip, box, '#f8fafc', '#cbd5e1');
        text(`cht:${span.key}`, clip, Math.max(box.x, clip.x) + 5, box.y + 18, span.label.slice(0, 30));
    }
    for (const leaf of plan.columns.positions.length > 1 ? [] : columns.leaves)
        text(
            `slot:${leaf.key}`,
            colClip,
            m.headerWidth + leaf.rank * m.columnWidth - scrollX + 8,
            m.headerHeight - 8,
            bindings.get(leaf.positionRef ?? '')?.label ?? '',
        );
    rect('corner', all, { x: 0, y: 0, width: m.headerWidth, height: m.headerHeight }, '#eef2f6', '#cbd5e1');
    text('corner-title', all, 12, 24, 'Worksheet');
    return frame;
}
