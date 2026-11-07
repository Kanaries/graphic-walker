import type { AxisLeaf, DomainBatch, FieldChannel, PaneData, PaneRecord, PreparedRecord, RenderPlan, ResultBinding } from '../core/types';
import { getDisplayDomain, positionCoordinate, positionTypeFor, barIsHorizontal } from '../core/domains';
import { seriesIdentityFor, seriesKeyFor } from '../core/series';
import { advanceBarStack } from '../core/prepared';
import { bindingValueLabel, toTypedValue, typedValueKey } from '../core/keys';
import { createColorEncoder, numericChannel, resolveDomainValues, type PositionScale } from './scales';
import { fitText, formatValue, measureText } from './text';
import { intersect, inflate, type Box, type HitGeometry, type HitRegion, type Point, type Primitive, type SceneFrame } from './types';

export const pointShapes = ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down', 'cross'] as const;
type Shape = (typeof pointShapes)[number];
export interface EncodedStyle {
    color: string;
    opacity: number;
    size: number;
    shape: Shape;
}
export function createEncoders(plan: RenderPlan, domains: DomainBatch): (record: PreparedRecord) => EncodedStyle {
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const get = (channel: FieldChannel | undefined, record: PreparedRecord, fallback: unknown) =>
        !channel ? fallback : 'value' in channel ? channel.value : record[bindings.get(channel.fieldRef)!.columnKey];
    const color = plan.channels?.color;
    const colorBinding = color && 'fieldRef' in color ? bindings.get(color.fieldRef)! : undefined;
    const colorDomain = colorBinding ? getDisplayDomain(plan, colorBinding.fieldRef, 'color', domains) : undefined;
    if (colorBinding && !colorDomain) throw new Error('domain-unavailable: color domain missing');
    const mapColor = colorDomain ? createColorEncoder(colorDomain, plan.scales?.[colorBinding!.fieldRef], plan.style?.palette) : undefined;
    const numeric = (name: 'size' | 'opacity', fallback: number, range: readonly [number, number]) => {
        const channel = plan.channels?.[name];
        if (!channel || 'value' in channel) return (record: PreparedRecord) => Number(get(channel, record, fallback));
        const binding = bindings.get(channel.fieldRef)!,
            domain = getDisplayDomain(plan, binding.fieldRef, name, domains);
        if (!domain) throw new Error(`domain-unavailable: ${name} domain missing`);
        return (record: PreparedRecord) => numericChannel(record[binding.columnKey], domain, plan.scales?.[binding.fieldRef], range);
    };
    const size = numeric(
        'size',
        plan.mark === 'line' ? (plan.style?.lineWidth ?? 2) : (plan.style?.pointSize ?? Math.PI * 16),
        plan.mark === 'line' ? [1, 6] : [16, 256],
    );
    const opacity = numeric('opacity', plan.style?.opacity ?? 1, [0.15, 1]);
    const shape = plan.channels?.shape;
    const shapeBinding = shape && 'fieldRef' in shape ? bindings.get(shape.fieldRef)! : undefined;
    const shapeDomain = shapeBinding ? getDisplayDomain(plan, shapeBinding.fieldRef, 'shape', domains) : undefined;
    if (shapeBinding && !shapeDomain) throw new Error('domain-unavailable: shape domain missing');
    const shapeValues = shapeDomain ? resolveDomainValues(shapeDomain, plan.scales?.[shapeBinding!.fieldRef]) : [];
    const shapeRanks = new Map(shapeValues.map((value, index) => [typedValueKey(toTypedValue(value)), index]));
    const shapeRange = shapeBinding ? (plan.scales?.[shapeBinding.fieldRef]?.range ?? pointShapes) : pointShapes;
    if (shapeRange.some((value) => !pointShapes.includes(value as Shape))) throw new Error('unsupported-encoding: point shape');
    return (record) => {
        let selectedShape = shape && 'value' in shape ? String(shape.value) : 'circle';
        if (shapeBinding) {
            const rank = shapeRanks.get(typedValueKey(toTypedValue(record[shapeBinding.columnKey])));
            const ordinal =
                plan.scales?.[shapeBinding.fieldRef]?.reverse && rank !== undefined ? shapeValues.length - 1 - rank : (rank ?? 0);
            selectedShape = String(shapeRange[ordinal % shapeRange.length]);
        }
        if (!pointShapes.includes(selectedShape as Shape)) throw new Error('unsupported-encoding: point shape');
        const area = size(record),
            alpha = opacity(record);
        if (!Number.isFinite(area) || area < 0 || !Number.isFinite(alpha))
            throw new Error('invalid-value: visual size/opacity must be finite and size nonnegative');
        return {
            color: mapColor ? mapColor(record[colorBinding!.columnKey]) : String(get(color, record, plan.style?.color ?? '#2563eb')),
            opacity: Math.max(0, Math.min(1, alpha)),
            size: area,
            shape: selectedShape as Shape,
        };
    };
}
function bounds(points: readonly Point[]): Box {
    const x = Math.min(...points.map((p) => p.x)),
        y = Math.min(...points.map((p) => p.y));
    return { x, y, width: Math.max(...points.map((p) => p.x)) - x, height: Math.max(...points.map((p) => p.y)) - y };
}
export function pointSymbol(
    shape: Shape,
    x: number,
    y: number,
    area: number,
): { primitive: Extract<Primitive, { kind: 'circle' | 'path' }>; geometry: HitGeometry; box: Box } {
    const radius = Math.sqrt(area / Math.PI);
    if (shape === 'circle')
        return {
            primitive: { kind: 'circle', x, y, radius, fill: '' },
            geometry: { kind: 'circle', x, y, radius },
            box: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 },
        };
    let relative: Point[];
    if (shape === 'square') {
        const r = Math.sqrt(area) / 2;
        relative = [
            { x: -r, y: -r },
            { x: r, y: -r },
            { x: r, y: r },
            { x: -r, y: r },
        ];
    } else if (shape === 'diamond') {
        const r = Math.sqrt(area / 2);
        relative = [
            { x: 0, y: -r },
            { x: r, y: 0 },
            { x: 0, y: r },
            { x: -r, y: 0 },
        ];
    } else if (shape === 'cross') {
        const r = Math.sqrt(area / 5) / 2;
        relative = [
            { x: -r, y: -3 * r },
            { x: r, y: -3 * r },
            { x: r, y: -r },
            { x: 3 * r, y: -r },
            { x: 3 * r, y: r },
            { x: r, y: r },
            { x: r, y: 3 * r },
            { x: -r, y: 3 * r },
            { x: -r, y: r },
            { x: -3 * r, y: r },
            { x: -3 * r, y: -r },
            { x: -r, y: -r },
        ];
    } else {
        const side = Math.sqrt((area * 4) / Math.sqrt(3)),
            h = (side * Math.sqrt(3)) / 2,
            sign = shape === 'triangle-up' ? 1 : -1;
        relative = [
            { x: 0, y: ((-h * 2) / 3) * sign },
            { x: side / 2, y: (h / 3) * sign },
            { x: -side / 2, y: (h / 3) * sign },
        ];
    }
    const points = relative.map((p) => ({ x: x + p.x, y: y + p.y }));
    return { primitive: { kind: 'path', points, closed: true, fill: '' }, geometry: { kind: 'polygon', points }, box: bounds(points) };
}
export interface PaneGeometryInput {
    plan: RenderPlan;
    pane: PaneData;
    row: AxisLeaf;
    column: AxisLeaf;
    xb?: ResultBinding;
    yb?: ResultBinding;
    xs: PositionScale;
    ys: PositionScale;
    plot: Box;
    clip: Box;
    frame: SceneFrame;
    encode: (record: PreparedRecord) => EncodedStyle;
    selected?: ReadonlySet<string>;
    focusId?: string;
}
export function drawPaneMarks(input: PaneGeometryInput): void {
    const { plan, pane, row, column, xb, yb, xs, ys, plot, clip, frame, encode } = input;
    const add = (id: string, primitive: Primitive) => frame.commands.push({ id, clip, primitive });
    const allBindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const recordPoint = (record: PaneRecord): Point => ({
        x: xs.map(xb ? positionCoordinate(xb, record.values[xb.columnKey]) : undefined),
        y: ys.map(yb ? positionCoordinate(yb, record.values[yb.columnKey]) : undefined),
    });
    const series = (record: PaneRecord) => record.seriesKey ?? seriesKeyFor(pane.key, seriesIdentityFor(plan, record.values));
    const hit = (records: readonly PaneRecord[], id: string, box: Box, geometry: HitGeometry, kind: 'datum' | 'segment' = 'datum') => {
        // Accessible zero-width marks keep a target. Fully clipped targets do not enter the live hit set.
        const visible = intersect(inflate(box, kind === 'segment' ? 3 : 1), clip);
        if (!visible.width || !visible.height) return;
        const first = records[0];
        const target: HitRegion = {
            id,
            paneKey: pane.key,
            datumKey: first.datumKey,
            datumKeys: records.map((record) => record.datumKey),
            slotId: JSON.stringify([row.slotId, column.slotId]),
            seriesKey: series(first),
            box,
            clip,
            values: first.values,
            recordValues: records.map((record) => record.values),
            rowKey: row.key,
            columnKey: column.key,
            kind,
            geometry,
            label: records
                .map((record) =>
                    plan.bindings
                        .filter((binding) => Object.prototype.hasOwnProperty.call(record.values, binding.columnKey))
                        .map((binding) => `${binding.label}: ${String(record.values[binding.rawColumnKey ?? binding.columnKey] ?? '∅')}`)
                        .join(', '),
                )
                .join(' → '),
        };
        frame.hits.push(target);
    };
    const selectedColor = (id: string, color: string) => (input.selected?.has(id) ? '#ea580c' : color);
    const ordered = [...pane.records].sort((a, b) => a.ordinal - b.ordinal);
    if (plan.mark === 'line') {
        const groups = new Map<string, PaneRecord[]>();
        for (const record of ordered) {
            const key = series(record),
                values = groups.get(key) ?? [];
            values.push(record);
            groups.set(key, values);
        }
        const progression =
            plan.lineProgression ??
            (xb && ['band', 'time'].includes(positionTypeFor(xb)) ? 'x' : yb && ['band', 'time'].includes(positionTypeFor(yb)) ? 'y' : 'x');
        const progressionBinding = progression === 'x' ? xb : yb,
            progressionScale = progression === 'x' ? xs : ys;
        for (const [seriesKey, records] of groups) {
            const styles = records.map((record) => encode(record.values));
            if (styles.some((style) => style.size !== styles[0].size || style.opacity !== styles[0].opacity))
                throw new Error('unsupported-encoding: line size and opacity must remain constant within a series');
            const explicit = records.some((record) => record.sequenceOrder !== undefined);
            if (explicit && records.some((record) => record.sequenceOrder === undefined))
                throw new Error('source-contract-violation: line sequenceOrder must cover every record in its series');
            const chunks: PaneRecord[][] = [];
            if (explicit) chunks.push([...records].sort((a, b) => a.sequenceOrder! - b.sequenceOrder! || a.ordinal - b.ordinal));
            else {
                let chunk: PaneRecord[] = [];
                for (const record of records) {
                    const value = progressionBinding ? record.values[progressionBinding.columnKey] : undefined;
                    if (progressionBinding && value === null) {
                        if (chunk.length) chunks.push(chunk);
                        chunks.push([record]);
                        chunk = [];
                    } else chunk.push(record);
                }
                if (chunk.length) chunks.push(chunk);
                for (const chunk of chunks)
                    chunk.sort((a, b) => {
                        const av = progressionBinding ? positionCoordinate(progressionBinding, a.values[progressionBinding.columnKey]) : 0,
                            bv = progressionBinding ? positionCoordinate(progressionBinding, b.values[progressionBinding.columnKey]) : 0;
                        const aa =
                            progressionScale.type === 'band'
                                ? progressionScale.values.findIndex(
                                      (v) => typedValueKey(toTypedValue(v)) === typedValueKey(toTypedValue(av)),
                                  )
                                : Number(av);
                        const bb =
                            progressionScale.type === 'band'
                                ? progressionScale.values.findIndex(
                                      (v) => typedValueKey(toTypedValue(v)) === typedValueKey(toTypedValue(bv)),
                                  )
                                : Number(bv);
                        return aa - bb || a.ordinal - b.ordinal;
                    });
            }
            for (const chunk of chunks) {
                let previous: PaneRecord | undefined;
                for (const record of chunk) {
                    const point = recordPoint(record),
                        valueMissing = (xb && record.values[xb.columnKey] === null) || (yb && record.values[yb.columnKey] === null);
                    if (valueMissing || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                        previous = undefined;
                        continue;
                    }
                    if (previous) {
                        const start = recordPoint(previous),
                            id = JSON.stringify(['segment', pane.key, seriesKey, previous.datumKey, record.datumKey]),
                            style = encode(record.values),
                            color = selectedColor(id, style.color);
                        if (style.size > 0 && style.opacity > 0) {
                            add(id, {
                                kind: 'line',
                                x1: start.x,
                                y1: start.y,
                                x2: point.x,
                                y2: point.y,
                                stroke: color,
                                width: style.size,
                                opacity: style.opacity,
                            });
                            hit(
                                [previous, record],
                                id,
                                inflate(bounds([start, point]), style.size / 2),
                                { kind: 'segment', start, end: point, width: style.size },
                                'segment',
                            );
                        }
                    }
                    previous = record;
                }
            }
        }
        return;
    }
    const stacks = new Map<string, { positive: number; negative: number }>();
    const records =
        plan.mark === 'bar' && plan.stack === 'zero'
            ? [...ordered].sort((a, b) => (a.seriesOrdinal ?? 0) - (b.seriesOrdinal ?? 0) || a.ordinal - b.ordinal)
            : ordered;
    for (const record of records) {
        const { x, y } = recordPoint(record),
            style = encode(record.values),
            id = `${pane.key}:${record.datumKey}`,
            color = selectedColor(id, style.color);
        if (!Number.isFinite(x) || !Number.isFinite(y) || style.opacity === 0) continue;
        if (plan.mark === 'point') {
            if (style.size === 0) continue;
            const point = pointSymbol(style.shape, x, y, style.size),
                primitive = { ...point.primitive, fill: color, opacity: style.opacity };
            add(id, primitive);
            hit([record], id, point.box, point.geometry);
            continue;
        }
        if (plan.mark === 'rect' || plan.mark === 'text') {
            const cell = { x: x - xs.bandwidth / 2, y: y - ys.bandwidth / 2, width: xs.bandwidth, height: ys.bandwidth };
            if (plan.mark === 'rect') {
                add(id, { kind: 'rect', box: cell, fill: color, opacity: style.opacity });
                hit([record], id, cell, { kind: 'rect', box: cell });
            } else {
                const channel = plan.channels?.text,
                    binding = channel && 'fieldRef' in channel ? allBindings.get(channel.fieldRef) : undefined;
                const value = channel ? ('value' in channel ? channel.value : record.values[binding!.columnKey]) : null;
                const formatted =
                    value === null
                        ? ''
                        : bindingValueLabel(binding, toTypedValue(value)) ?? formatValue(
                              value,
                              binding ? positionTypeFor(binding) : typeof value === 'number' ? 'linear' : 'band',
                              binding ? plan.axes?.[binding.fieldRef]?.format : undefined,
                          );
                const size = plan.style?.fontSize ?? 12,
                    fontFamily = plan.style?.fontFamily ?? 'sans-serif',
                    text = fitText(formatted, cell.width - 8, size, fontFamily);
                add(id, {
                    kind: 'text',
                    x,
                    y: y + size * 0.35,
                    text,
                    fill: color,
                    size,
                    fontFamily,
                    align: 'center',
                    opacity: style.opacity,
                });
                const box = {
                    x: x - measureText(text, size, fontFamily) / 2,
                    y: y - size * 0.65,
                    width: measureText(text, size, fontFamily),
                    height: size,
                };
                hit([record], id, box, { kind: 'rect', box });
            }
            continue;
        }
        const horizontal = barIsHorizontal(plan, yb);
        const valueBinding = horizontal ? xb : yb,
            positionBinding = horizontal ? yb : xb,
            valueScale = horizontal ? xs : ys,
            positionScale = horizontal ? ys : xs;
        const value = valueBinding ? record.values[valueBinding.columnKey] : undefined,
            category = positionBinding ? record.values[positionBinding.columnKey] : undefined;
        if (!valueBinding || typeof value !== 'number') continue;
        const { start, end } = plan.stack === 'zero' ? advanceBarStack(stacks, category, value) : { start: 0, end: value };
        const a = valueScale.map(start),
            b = valueScale.map(end);
        let thickness = positionScale.type === 'band' ? positionScale.bandwidth * 0.72 : (plan.style?.barWidth ?? 8);
        let center = horizontal ? y : x;
        if (positionBinding?.valueType === 'interval' && Array.isArray(category)) {
            const p0 = positionScale.map(category[0]),
                p1 = positionScale.map(category[1]);
            thickness = Math.abs(p1 - p0);
            center = (p0 + p1) / 2;
        }
        if (plan.barLayout === 'grouped') {
            const count = pane.seriesCount;
            if (count === undefined || record.seriesOrdinal === undefined || count < 1 || record.seriesOrdinal >= count)
                throw new Error('source-contract-violation: grouped bars require complete series ordinals');
            const slot = thickness / count;
            center += -thickness / 2 + slot * (record.seriesOrdinal + 0.5);
            thickness = slot * 0.9;
        }
        const box = horizontal
            ? { x: Math.min(a, b), y: center - thickness / 2, width: Math.abs(b - a), height: thickness }
            : { x: center - thickness / 2, y: Math.min(a, b), width: thickness, height: Math.abs(b - a) };
        add(id, { kind: 'rect', box, fill: color, opacity: style.opacity });
        hit([record], id, box, { kind: 'rect', box });
    }
}
