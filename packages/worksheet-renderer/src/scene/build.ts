import type { AxisWindow, DomainBatch, PaneBatch, RenderPlan, ResultBinding } from '../core/types';
import { getDisplayDomain, positionTypeFor } from '../core/domains';
import { intersect, inflate, type Box, type Primitive, type SceneFrame, type HeaderTarget } from './types';
import { createPositionScale, createColorEncoder, resolveDomainValues, numericChannel } from './scales';
import { createEncoders, drawPaneMarks, pointSymbol, pointShapes } from './marks';
import { fitText, formatValue } from './text';
import { prepareHitIndex } from './hit';

export interface LayoutMetrics {
    rowHeight: number;
    columnWidth: number;
    headerWidth: number;
    headerHeight: number;
    legendWidth: number;
    columnLevelHeight: number;
}
export function layoutMetrics(plan: RenderPlan, width: number, height = 720): LayoutMetrics {
    const hasLegend = ['color', 'size', 'opacity', 'shape'].some((name) => {
        const channel = plan.channels?.[name as 'color'];
        return channel && 'fieldRef' in channel;
    });
    const columnLevels = plan.columns.facets.length + (plan.columns.positions.length > 1 ? 1 : 0);
    const columnLevelHeight = Math.min(28, Math.max(9, Math.floor((Math.max(90, height * 0.4) - 26) / Math.max(1, columnLevels))));
    return {
        rowHeight: 180,
        columnWidth: 240,
        headerWidth: Math.min(
            Math.max(112, (plan.rows.facets.length + (plan.rows.positions.length > 1 ? 1 : 0)) * 78),
            Math.max(112, width * 0.35),
        ),
        headerHeight: Math.max(40, columnLevels * columnLevelHeight + (plan.columns.positions.length > 1 ? 0 : 26)),
        legendWidth: hasLegend ? Math.min(168, Math.max(96, width * 0.23)) : 0,
        columnLevelHeight,
    };
}
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
    focusId?: string;
    brush?: Box;
}
export function buildScene(input: SceneInput): SceneFrame {
    const { plan, width, height, scrollX, scrollY, rows, columns, domains, panes } = input;
    const m = layoutMetrics(plan, width, height),
        all: Box = { x: 0, y: 0, width, height };
    const body: Box = {
        x: m.headerWidth,
        y: m.headerHeight,
        width: Math.max(0, width - m.headerWidth - m.legendWidth),
        height: Math.max(0, height - m.headerHeight),
    };
    const frame: SceneFrame = {
        frameId: input.frameId,
        width,
        height,
        commands: [],
        hits: [],
        headers: [],
        rowStart: rows.range.start,
        columnStart: columns.range.start,
    };
    const fontFamily = plan.style?.fontFamily ?? 'sans-serif',
        fontSize = plan.style?.fontSize ?? 11;
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
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const lookup = new Map(panes.panes.map((pane) => [`${pane.rowRank}:${pane.columnRank}`, pane]));
    const encode = createEncoders(plan, domains);
    rect('background', all, all, plan.style?.background ?? '#fff');
    for (const row of rows.leaves)
        for (const column of columns.leaves) {
            const left = m.headerWidth + column.rank * m.columnWidth - scrollX,
                top = m.headerHeight + row.rank * m.rowHeight - scrollY;
            const cell: Box = { x: left, y: top, width: m.columnWidth, height: m.rowHeight },
                clip = intersect(body, cell);
            if (!clip.width || !clip.height) continue;
            const id = `${row.key}:${column.key}`,
                pane = lookup.get(`${row.rank}:${column.rank}`);
            rect(`cell:${id}`, clip, cell, plan.style?.background ?? '#fff', '#e2e8f0');
            const plot: Box = { x: left + 48, y: top + 22, width: m.columnWidth - 60, height: m.rowHeight - 52 },
                plotClip = intersect(clip, plot);
            const xb = bindings.get(column.positionRef ?? ''),
                yb = bindings.get(row.positionRef ?? '');
            const covered = panes.coveredWindows.some(
                (window) =>
                    row.rank >= window.rows.start &&
                    row.rank < window.rows.end &&
                    column.rank >= window.columns.start &&
                    column.rank < window.columns.end,
            );
            if (!covered || (pane && !pane.complete)) {
                text(`loading:${id}`, clip, left + 60, top + 60, 'Loading…');
                continue;
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
                    Math.ceil(
                        ticks.length / Math.max(1, Math.floor((vertical ? plot.height : plot.width) / (vertical ? fontSize + 6 : 40))),
                    ),
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
                                ? { kind: 'line', x1: plot.x, y1: at, x2: plot.x + plot.width, y2: at, stroke: '#e2e8f0' }
                                : { kind: 'line', x1: at, y1: plot.y, x2: at, y2: plot.y + plot.height, stroke: '#e2e8f0' },
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
                        ? { kind: 'line', x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, stroke: '#94a3b8' }
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
                    encode,
                    selected: input.selected,
                    focusId: input.focusId,
                });
        }
    const rowClip: Box = { x: 0, y: m.headerHeight, width: m.headerWidth, height: Math.max(0, height - m.headerHeight) },
        columnClip: Box = { x: m.headerWidth, y: 0, width: Math.max(0, width - m.headerWidth - m.legendWidth), height: m.headerHeight };
    rect('row-background', rowClip, rowClip, '#f8fafc');
    rect('column-background', columnClip, columnClip, '#f8fafc');
    const rowDepth = Math.max(1, plan.rows.facets.length + (plan.rows.positions.length > 1 ? 1 : 0)),
        rowLevelWidth = m.headerWidth / rowDepth;
    for (const [axis, window, region] of [
        ['row', rows, rowClip],
        ['column', columns, columnClip],
    ] as const) {
        for (const span of window.ancestors) {
            const box: Box =
                axis === 'row'
                    ? {
                          x: span.depth * rowLevelWidth,
                          y: m.headerHeight + span.start * m.rowHeight - scrollY,
                          width: rowLevelWidth,
                          height: (span.end - span.start) * m.rowHeight,
                      }
                    : {
                          x: m.headerWidth + span.start * m.columnWidth - scrollX,
                          y: span.depth * m.columnLevelHeight,
                          width: (span.end - span.start) * m.columnWidth,
                          height: m.columnLevelHeight,
                      };
            const clip = intersect(region, box);
            if (!clip.width || !clip.height) continue;
            const slot = span.kind === 'slot' || span.key.startsWith('["slot-header"'),
                expanded = slot ? undefined : span.expanded;
            const canCollapse =
                !slot && (expanded !== undefined || span.path.length < plan[axis === 'row' ? 'rows' : 'columns'].facets.length);
            const target: HeaderTarget = {
                kind: 'header',
                id: `header:${axis}:${span.key}`,
                key: span.key,
                axis,
                path: span.path,
                fieldRef: slot
                    ? window.leaves.find((leaf) => leaf.rank === span.start)?.positionRef
                    : span.path[span.path.length - 1]?.fieldRef,
                box,
                clip,
                label: span.label,
                expanded: canCollapse ? (expanded ?? true) : undefined,
                canCollapse,
            };
            frame.headers.push(target);
            const prefix = axis === 'row' ? 'rh' : 'ch';
            rect(`${prefix}:${span.key}`, clip, box, '#f8fafc', '#cbd5e1');
            const label = (canCollapse ? (target.expanded ? '▾ ' : '▸ ') : '') + span.label;
            const size = axis === 'column' ? Math.min(fontSize, Math.max(7, m.columnLevelHeight - 5)) : fontSize;
            text(
                `${prefix}t:${span.key}`,
                clip,
                Math.max(box.x, clip.x) + 4,
                Math.max(box.y, clip.y) + Math.min(axis === 'row' ? 17 : m.columnLevelHeight - 5, size + 5),
                label,
                'left',
                clip.width - 8,
                size,
            );
        }
    }
    for (const leaf of plan.columns.positions.length > 1 ? [] : columns.leaves)
        text(
            `slot:${leaf.key}`,
            columnClip,
            m.headerWidth + leaf.rank * m.columnWidth - scrollX + 8,
            m.headerHeight - 8,
            bindings.get(leaf.positionRef ?? '')?.label ?? '',
            'left',
            m.columnWidth - 16,
        );
    rect('corner', all, { x: 0, y: 0, width: m.headerWidth, height: m.headerHeight }, '#eef2f6', '#cbd5e1');
    text('corner-title', all, 12, 24, 'Worksheet', 'left', m.headerWidth - 24);
    if (m.legendWidth) {
        const legend: Box = { x: width - m.legendWidth, y: 0, width: m.legendWidth, height };
        rect('legend-background', all, legend, '#f8fafc', '#cbd5e1');
        let y = 20;
        for (const name of ['color', 'size', 'opacity', 'shape'] as const) {
            const channel = plan.channels?.[name];
            if (!channel || !('fieldRef' in channel)) continue;
            const binding = bindings.get(channel.fieldRef)!,
                domain = getDisplayDomain(plan, binding.fieldRef, name, domains);
            if (!domain) throw new Error(`domain-unavailable: ${name} legend`);
            const values = resolveDomainValues(domain, plan.scales?.[binding.fieldRef]);
            text(`legend-title:${name}`, legend, legend.x + 10, y, `${binding.label} (${name})`, 'left', legend.width - 20);
            y += 20;
            const entries = domain.type === 'band' ? values : [values[0], Number(values[0]) / 2 + Number(values[1]) / 2, values[1]];
            const available = Math.max(
                1,
                Math.floor(
                    (height - y - 35) /
                        18 /
                        Math.max(1, ['color', 'size', 'opacity', 'shape'].filter((key) => plan.channels?.[key as 'color']).length),
                ),
            );
            const displayed = entries.slice(0, Math.min(12, available));
            const mapColor =
                name === 'color' ? createColorEncoder(domain, plan.scales?.[binding.fieldRef], plan.style?.palette) : undefined;
            if (mapColor && domain.type !== 'band') {
                const span = Number(values[1]) - Number(values[0]);
                for (let step = 0; step < 24; step++)
                    rect(
                        `legend-gradient:${name}:${step}`,
                        legend,
                        {
                            x: legend.x + 10 + (step * (legend.width - 20)) / 24,
                            y: y - 10,
                            width: (legend.width - 20) / 24 + 0.1,
                            height: 10,
                        },
                        mapColor(Number(values[0]) + (span * step) / 23),
                    );
                y += 16;
            }
            displayed.forEach((value, index) => {
                if (mapColor)
                    rect(`legend-swatch:${name}:${index}`, legend, { x: legend.x + 10, y: y - 9, width: 10, height: 10 }, mapColor(value));
                else if (name === 'opacity')
                    add(`legend-swatch:${name}:${index}`, legend, {
                        kind: 'rect',
                        box: { x: legend.x + 10, y: y - 9, width: 12, height: 10 },
                        fill: plan.style?.color ?? '#2563eb',
                        opacity: Math.max(0, Math.min(1, numericChannel(value, domain, plan.scales?.[binding.fieldRef], [0.15, 1]))),
                    });
                else if (name === 'size') {
                    const size = numericChannel(value, domain, plan.scales?.[binding.fieldRef], plan.mark === 'line' ? [1, 6] : [16, 256]);
                    if (plan.mark === 'line')
                        add(`legend-swatch:${name}:${index}`, legend, {
                            kind: 'line',
                            x1: legend.x + 8,
                            y1: y - 4,
                            x2: legend.x + 24,
                            y2: y - 4,
                            stroke: plan.style?.color ?? '#2563eb',
                            width: Math.min(12, size),
                        });
                    else
                        add(`legend-swatch:${name}:${index}`, legend, {
                            kind: 'circle',
                            x: legend.x + 16,
                            y: y - 4,
                            radius: Math.min(9, Math.sqrt(size / Math.PI)),
                            fill: plan.style?.color ?? '#2563eb',
                        });
                } else if (name === 'shape') {
                    const range = plan.scales?.[binding.fieldRef]?.range ?? pointShapes,
                        ordinal = plan.scales?.[binding.fieldRef]?.reverse ? values.length - 1 - index : index;
                    const primitive = pointSymbol(
                        range[ordinal % range.length] as (typeof pointShapes)[number],
                        legend.x + 16,
                        y - 4,
                        64,
                    ).primitive;
                    add(`legend-swatch:${name}:${index}`, legend, { ...primitive, fill: plan.style?.color ?? '#2563eb' });
                }
                text(
                    `legend-value:${name}:${index}`,
                    legend,
                    legend.x + 30,
                    y,
                    formatValue(value, domain.type, plan.axes?.[binding.fieldRef]?.format),
                    'left',
                    legend.width - 38,
                );
                y += 18;
            });
            if (entries.length > displayed.length) {
                text(
                    `legend-more:${name}`,
                    legend,
                    legend.x + 10,
                    y,
                    `+${entries.length - displayed.length} more`,
                    'left',
                    legend.width - 20,
                );
                y += 18;
            }
            y += 12;
        }
    }
    if (input.focusId) {
        const target = frame.hits.find((hit) => hit.id === input.focusId) ?? frame.headers.find((header) => header.id === input.focusId);
        if (target)
            add('focus-ring', target.clip, {
                kind: 'rect',
                box: inflate(target.box, 2),
                fill: 'transparent',
                stroke: '#111827',
                strokeWidth: 2,
            });
    }
    if (input.brush) add('selection-brush', body, { kind: 'rect', box: input.brush, fill: '#93c5fd', stroke: '#2563eb', opacity: 0.3 });
    prepareHitIndex(frame);
    return frame;
}
