import type { AxisLeaf, DomainBatch, PaneData, RenderPlan, ResultBinding } from '../core/types';
import { getDisplayDomain } from '../core/domains';
import { createPositionScale } from './scales';
import { drawPaneMarks, type EncodedStyle } from './marks';
import { fitText, formatValue } from './text';
import { intersect, type Box, type Primitive, type SceneFrame } from './types';
import type { PreparedRecord } from '../core/types';
export interface LocalPaneInput {
    plan: RenderPlan;
    row: AxisLeaf;
    column: AxisLeaf;
    pane?: PaneData;
    domains: DomainBatch;
    width: number;
    height: number;
    covered: boolean;
    domainsReady?: boolean;
    dataStatus?: 'complete' | 'loading' | 'preview';
    encode?: (record: PreparedRecord) => EncodedStyle;
    left?: number;
    top?: number;
    viewportClip?: Box;
    frame?: SceneFrame;
    selected?: ReadonlySet<string>;
}
/** Axis and mark geometry compiled once in pane-local coordinates. */
export function buildPaneGeometry(input: LocalPaneInput): SceneFrame {
    const { plan, row, column, pane, domains, width, height, covered, encode } = input;
    const frame: SceneFrame = input.frame ?? {
        frameId: 0,
        width,
        height,
        rowStart: row.rank,
        columnStart: column.rank,
        commands: [],
        hits: [],
        headers: [],
    };
    const left = input.left ?? 0,
        top = input.top ?? 0,
        cell: Box = { x: left, y: top, width, height },
        clip = input.viewportClip ? intersect(input.viewportClip, cell) : cell,
        m = { columnWidth: width, rowHeight: height };
    if (!clip.width || !clip.height) return frame;
    const fontFamily = plan.style?.fontFamily ?? 'sans-serif',
        fontSize = plan.style?.fontSize ?? 11;
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const add = (id: string, clip: Box, primitive: Primitive) => frame.commands.push({ id, clip, primitive });
    const rect = (id: string, clip: Box, box: Box, fill: string, stroke?: string) => add(id, clip, { kind: 'rect', box, fill, stroke });
    const text = (
        id: string,
        clip: Box,
        x: number,
        y: number,
        label: string,
        align: 'left' | 'center' | 'right' = 'left',
        maxWidth = Infinity,
        size = fontSize,
    ) => add(id, clip, { kind: 'text', x, y, text: fitText(label, maxWidth, size, fontFamily), fill: '#334155', size, fontFamily, align });
    const id = `${row.key}:${column.key}`;
    rect(`cell:${id}`, clip, cell, plan.style?.background ?? '#fff', '#e2e8f0');
    const plot: Box = {
            x: left + 48,
            y: top + 22,
            width: m.columnWidth - 60,
            height: m.rowHeight - 52,
        },
        plotClip = intersect(clip, plot);
    const xb = bindings.get(column.positionRef ?? ''),
        yb = bindings.get(row.positionRef ?? '');
    if (input.domainsReady === false || (!covered && !pane?.complete) || (pane && !pane.complete)) {
        text(
            `loading:${id}`,
            clip,
            left + 16,
            top + 42,
            input.dataStatus === 'preview' ? 'Preview: incomplete data' : 'Loading…',
            'left',
            Math.max(0, cell.width - 32),
        );
        return frame;
    }
    const xDomain = xb ? getDisplayDomain(plan, xb.fieldRef, 'x', domains, row, column) : undefined,
        yDomain = yb ? getDisplayDomain(plan, yb.fieldRef, 'y', domains, row, column) : undefined;
    if ((xb && !xDomain) || (yb && !yDomain)) throw new Error('domain-unavailable: pane position domain missing');
    const xs = createPositionScale(xDomain, xb ? plan.scales?.[xb.fieldRef] : undefined, plot.x, plot.x + plot.width),
        ys = createPositionScale(yDomain, yb ? plan.scales?.[yb.fieldRef] : undefined, plot.y + plot.height, plot.y);
    for (const [binding, scale, vertical] of [
        [xb, xs, false],
        [yb, ys, true],
    ] as const) {
        if (!binding) continue;
        const axis = plan.axes?.[binding.fieldRef];
        if (axis?.hidden) continue;
        const ticks = scale.ticks(axis?.tickCount ?? (scale.type === 'band' ? 10 : 3));
        const labelStride = Math.max(
            1,
            Math.ceil(ticks.length / Math.max(1, Math.floor((vertical ? plot.height : plot.width) / (vertical ? fontSize + 6 : 40)))),
        );
        ticks.forEach((value, index) => {
            const at = scale.map(value);
            if (!Number.isFinite(at)) return;
            const label = formatValue(value, scale.type, axis?.format);
            if (axis?.grid)
                add(
                    `grid:${vertical ? 'y' : 'x'}:${id}:${index}`,
                    plotClip,
                    vertical
                        ? {
                              kind: 'line',
                              x1: plot.x,
                              y1: at,
                              x2: plot.x + plot.width,
                              y2: at,
                              stroke: '#e2e8f0',
                          }
                        : {
                              kind: 'line',
                              x1: at,
                              y1: plot.y,
                              x2: at,
                              y2: plot.y + plot.height,
                              stroke: '#e2e8f0',
                          },
                );
            if (index % labelStride) return;
            if (vertical) text(`y:${id}:${index}`, clip, plot.x - 5, at + fontSize * 0.35, label, 'right', 40);
            else
                text(
                    `x:${id}:${index}`,
                    clip,
                    at,
                    plot.y + plot.height + 16,
                    label,
                    'center',
                    Math.max(16, plot.width / Math.max(1, Math.ceil(ticks.length / labelStride)) - 4),
                );
        });
        add(
            `axis:${vertical ? 'y' : 'x'}:${id}`,
            clip,
            vertical
                ? {
                      kind: 'line',
                      x1: plot.x,
                      y1: plot.y,
                      x2: plot.x,
                      y2: plot.y + plot.height,
                      stroke: '#94a3b8',
                  }
                : {
                      kind: 'line',
                      x1: plot.x,
                      y1: plot.y + plot.height,
                      x2: plot.x + plot.width,
                      y2: plot.y + plot.height,
                      stroke: '#94a3b8',
                  },
        );
    }
    const title = (binding: ResultBinding | undefined) =>
        binding && !plan.axes?.[binding.fieldRef]?.hidden
            ? plan.axes?.[binding.fieldRef]?.title === null
                ? ''
                : (plan.axes?.[binding.fieldRef]?.title ?? binding.label)
            : '';
    text(`title:${id}`, clip, left + 48, top + 14, [title(yb), title(xb)].filter(Boolean).join(' / '), 'left', plot.width);
    if (pane)
        drawPaneMarks({
            plan,
            pane,
            row,
            column,
            xb,
            yb,
            xs,
            ys,
            plot,
            clip: plotClip,
            frame,
            encode: encode!,
            selected: input.selected,
        });
    return frame;
}
