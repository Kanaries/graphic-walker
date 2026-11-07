import type { AxisLeaf, DomainBatch, FieldChannel, PaneData, PaneRecord, PreparedRecord, RenderPlan, ResultBinding } from '../core/types';
import { getDisplayDomain, positionCoordinate, positionTypeFor, barIsHorizontal } from '../core/domains';
import { seriesIdentityFor, seriesKeyFor } from '../core/series';
import { computeStackEndpoints } from '../core/stack';
import { bindingValueLabel, toTypedValue, typedValueKey } from '../core/keys';
import { createColorEncoder, numericChannel, resolveDomainValues, type PositionScale } from './scales';
import { fitText, formatValue, measureText } from './text';
import { drawArcMarks } from './arc';
import { drawBoxplotMarks } from './boxplot';
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
        plan.mark === 'line' || plan.mark === 'trail'
            ? (plan.style?.lineWidth ?? 2)
            : plan.mark === 'tick'
              ? (plan.style?.tickSize ?? 20)
              : plan.mark === 'text'
                ? (plan.style?.fontSize ?? 12)
                : (plan.style?.pointSize ?? Math.PI * 16),
        plan.mark === 'line' || plan.mark === 'trail'
            ? [1, 6]
            : plan.mark === 'tick' ? [4, 32] : plan.mark === 'text' ? [8, 24] : [16, 256],
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
    domains: DomainBatch;
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

/** Sort each continuous run without moving a missing progression value across its neighbours. */
function sequenceChunks(
    records: readonly PaneRecord[],
    progressionBinding: ResultBinding | undefined,
    progressionScale: PositionScale,
    mark: RenderPlan['mark'],
): PaneRecord[][] {
    const explicit = records.some((record) => record.sequenceOrder !== undefined);
    if (explicit && records.some((record) => record.sequenceOrder === undefined))
        throw new Error(`source-contract-violation: ${mark} sequenceOrder must cover every record in its series`);
    if (explicit) return [[...records].sort((a, b) => a.sequenceOrder! - b.sequenceOrder! || a.ordinal - b.ordinal)];
    const chunks: PaneRecord[][] = [];
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
    const bandRanks = new Map(progressionScale.values.map((value, rank) => [typedValueKey(toTypedValue(value)), rank]));
    const coordinate = (record: PaneRecord) => {
        const value = progressionBinding ? positionCoordinate(progressionBinding, record.values[progressionBinding.columnKey]) : 0;
        return progressionScale.type === 'band' ? (bandRanks.get(typedValueKey(toTypedValue(value))) ?? -1) : Number(value);
    };
    for (const part of chunks) part.sort((a, b) => coordinate(a) - coordinate(b) || a.ordinal - b.ordinal);
    return chunks;
}

/** Shared cross-sections make neighbouring variable-width segments meet at a turn. */
function trailOffsets(points: readonly Point[], widths: readonly number[]): Point[] {
    const normals = points.slice(1).map((point, index) => {
        const start = points[index],
            dx = point.x - start.x,
            dy = point.y - start.y,
            length = Math.hypot(dx, dy);
        return length ? { x: -dy / length, y: dx / length } : undefined;
    });
    return points.map((_, index) => {
        const before = normals[index - 1],
            after = normals[index],
            normal = after ?? before ?? { x: 0, y: 1 },
            half = widths[index] / 2;
        if (!before || !after) return { x: normal.x * half, y: normal.y * half };
        const sum = { x: before.x + after.x, y: before.y + after.y },
            length = Math.hypot(sum.x, sum.y);
        // A reversal has no unique miter; keep its cross-section finite.
        if (length < 1e-6) return { x: normal.x * half, y: normal.y * half };
        const unit = { x: sum.x / length, y: sum.y / length },
            projection = unit.x * after.x + unit.y * after.y,
            distance = Math.min(half / projection, half * 4);
        return { x: unit.x * distance, y: unit.y * distance };
    });
}
export function drawPaneMarks(input: PaneGeometryInput): void {
    const { plan, pane, row, column, xb, yb, xs, ys, plot, clip, frame, encode } = input;
    const add = (id: string, primitive: Primitive, interactionId?: string) => frame.commands.push({ id, clip, primitive, interactionId });
    const allBindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const recordPoint = (record: PaneRecord): Point => ({
        x: xs.map(xb ? positionCoordinate(xb, record.values[xb.columnKey]) : undefined),
        y: ys.map(yb ? positionCoordinate(yb, record.values[yb.columnKey]) : undefined),
    });
    const series = (record: PaneRecord) => record.seriesKey ?? seriesKeyFor(pane.key, seriesIdentityFor(plan, record.values));
    const hit = (
        records: readonly PaneRecord[], id: string, box: Box, geometry: HitGeometry,
        kind: 'datum' | 'segment' = 'datum', label?: string,
    ) => {
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
            label: label ?? records
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
    if (plan.mark === 'arc') {
        drawArcMarks(input, { add, hit, selectedColor });
        return;
    }
    if (plan.mark === 'boxplot') {
        drawBoxplotMarks(input, { add, hit, selectedColor });
        return;
    }
    const ordered = [...pane.records].sort((a, b) => a.ordinal - b.ordinal);
    if (plan.mark === 'line' || plan.mark === 'area' || plan.mark === 'trail') {
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
            progressionScale = progression === 'x' ? xs : ys,
            valueBinding = progression === 'x' ? yb : xb,
            valueScale = progression === 'x' ? ys : xs;
        let areaValues: ReadonlyMap<string, { start: number; end: number }> = new Map();
        if (plan.mark === 'area' && valueBinding && plan.stack && plan.stack !== 'none') {
            areaValues = computeStackEndpoints(ordered, valueBinding, progressionBinding, plan.stack);
        } else if (plan.mark === 'area' && valueBinding) {
            const values = new Map<string, { start: number; end: number }>();
            for (const record of ordered) {
                const value = record.values[valueBinding.columnKey];
                if (typeof value !== 'number' || !Number.isFinite(value)) continue;
                values.set(record.datumKey, { start: 0, end: value });
            }
            areaValues = values;
        }
        const missing = (record: PaneRecord) =>
            (xb && record.values[xb.columnKey] === null) || (yb && record.values[yb.columnKey] === null);
        for (const [seriesKey, records] of groups) {
            const styles = new Map(records.map((record) => [record.datumKey, encode(record.values)]));
            const firstStyle = styles.get(records[0].datumKey)!;
            if (
                plan.mark === 'line' &&
                [...styles.values()].some((style) => style.size !== firstStyle.size || style.opacity !== firstStyle.opacity)
            )
                throw new Error('unsupported-encoding: line size and opacity must remain constant within a series');
            for (const chunk of sequenceChunks(records, progressionBinding, progressionScale, plan.mark)) {
                const runs: PaneRecord[][] = [];
                let run: PaneRecord[] = [];
                for (const record of chunk) {
                    const point = recordPoint(record);
                    if (missing(record) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                        if (run.length) runs.push(run);
                        run = [];
                    } else run.push(record);
                }
                if (run.length) runs.push(run);
                for (const sequence of runs) {
                    const positions = sequence.map(recordPoint),
                        offsets = plan.mark === 'trail'
                            ? trailOffsets(positions, sequence.map((record) => styles.get(record.datumKey)!.size))
                            : [];
                    for (let index = 1; index < sequence.length; index++) {
                        const previous = sequence[index - 1],
                            record = sequence[index],
                            start = positions[index - 1],
                            point = positions[index],
                            id = JSON.stringify(['segment', pane.key, seriesKey, previous.datumKey, record.datumKey]),
                            style = styles.get(record.datumKey)!,
                            previousStyle = styles.get(previous.datumKey)!,
                            color = selectedColor(id, style.color);
                        if (style.opacity === 0) continue;
                        if (plan.mark === 'line') {
                            if (style.size === 0) continue;
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
                            continue;
                        }
                        let points: Point[];
                        if (plan.mark === 'area') {
                            const a = areaValues.get(previous.datumKey),
                                b = areaValues.get(record.datumKey);
                            if (!a || !b) continue;
                            const vertex = (point: Point, value: number) => progression === 'x'
                                ? { x: point.x, y: valueScale.map(value) }
                                : { x: valueScale.map(value), y: point.y };
                            points = [vertex(start, a.end), vertex(point, b.end), vertex(point, b.start), vertex(start, a.start)];
                        } else {
                            if (style.size === 0 && previousStyle.size === 0) continue;
                            const a = offsets[index - 1],
                                b = offsets[index];
                            points = [
                                { x: start.x + a.x, y: start.y + a.y },
                                { x: point.x + b.x, y: point.y + b.y },
                                { x: point.x - b.x, y: point.y - b.y },
                                { x: start.x - a.x, y: start.y - a.y },
                            ];
                        }
                        if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) continue;
                        add(id, { kind: 'path', points, closed: true, fill: color, opacity: style.opacity });
                        hit([previous, record], id, bounds(points), { kind: 'polygon', points }, 'segment');
                    }
                }
            }
        }
        return;
    }
    const horizontal = barIsHorizontal(plan, yb),
        barValueBinding = horizontal ? xb : yb,
        barPositionBinding = horizontal ? yb : xb,
        stackEndpoints = plan.mark === 'bar' && barValueBinding && plan.stack && plan.stack !== 'none'
            ? computeStackEndpoints(ordered, barValueBinding, barPositionBinding, plan.stack)
            : undefined;
    const records =
        stackEndpoints
            ? [...ordered].sort((a, b) => (a.seriesOrdinal ?? 0) - (b.seriesOrdinal ?? 0) || a.ordinal - b.ordinal)
            : ordered;
    for (const record of records) {
        const { x, y } = recordPoint(record),
            style = encode(record.values),
            id = `${pane.key}:${record.datumKey}`,
            color = selectedColor(id, style.color);
        if (!Number.isFinite(x) || !Number.isFinite(y) || style.opacity === 0) continue;
        if (plan.mark === 'point' || plan.mark === 'circle') {
            if (style.size === 0) continue;
            const point = pointSymbol(plan.mark === 'circle' ? 'circle' : style.shape, x, y, style.size),
                primitive = { ...point.primitive, fill: color, opacity: style.opacity };
            add(id, primitive);
            hit([record], id, point.box, point.geometry);
            continue;
        }
        if (plan.mark === 'tick') {
            const thickness = plan.style?.tickThickness ?? plan.style?.lineWidth ?? 1;
            if (style.size === 0 || thickness === 0) continue;
            const horizontal = !xb || (!!yb && positionTypeFor(xb) === 'band' && positionTypeFor(yb) !== 'band');
            const box = horizontal
                ? { x: x - style.size / 2, y: y - thickness / 2, width: style.size, height: thickness }
                : { x: x - thickness / 2, y: y - style.size / 2, width: thickness, height: style.size };
            add(id, { kind: 'rect', box, fill: color, opacity: style.opacity });
            hit([record], id, box, { kind: 'rect', box });
            continue;
        }
        if (plan.mark === 'rect' || plan.mark === 'text') {
            const width = plan.mark === 'text' && xs.type !== 'band' ? plot.width : xs.bandwidth,
                height = plan.mark === 'text' && ys.type !== 'band' ? plot.height : ys.bandwidth,
                cell = { x: x - width / 2, y: y - height / 2, width, height };
            if (plan.mark === 'rect') {
                if (plan.channels?.size && style.size === 0) continue;
                const factor = plan.channels?.size ? Math.sqrt(Math.min(1, style.size / (width * height))) : 1,
                    box = { x: x - width * factor / 2, y: y - height * factor / 2, width: width * factor, height: height * factor };
                add(id, { kind: 'rect', box, fill: color, opacity: style.opacity });
                hit([record], id, box, { kind: 'rect', box });
            } else {
                if (style.size === 0) continue;
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
                const size = style.size,
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
        const valueBinding = horizontal ? xb : yb,
            positionBinding = horizontal ? yb : xb,
            valueScale = horizontal ? xs : ys,
            positionScale = horizontal ? ys : xs;
        const value = valueBinding ? record.values[valueBinding.columnKey] : undefined,
            category = positionBinding ? record.values[positionBinding.columnKey] : undefined;
        if (!valueBinding || typeof value !== 'number') continue;
        const endpoints = stackEndpoints ? stackEndpoints.get(record.datumKey) : { start: 0, end: value };
        if (!endpoints) continue;
        const { start, end } = endpoints;
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
