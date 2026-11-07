import type { PaneRecord } from '../core/types';
import { barIsHorizontal, positionCoordinate } from '../core/domains';
import { bindingValueLabel, toTypedValue } from '../core/keys';
import type { PaneGeometryInput } from './marks';
import { formatValue } from './text';
import type { Box, HitGeometry, Point, Primitive } from './types';

const summaryRoles = ['lower', 'q1', 'median', 'q3', 'upper'] as const;
type SummaryRole = (typeof summaryRoles)[number];
interface BoxplotGroup {
    summaries: Map<SummaryRole, PaneRecord>;
    outliers: PaneRecord[];
}
interface BoxplotCallbacks {
    add(id: string, primitive: Primitive, interactionId?: string): unknown;
    hit(records: readonly PaneRecord[], id: string, box: Box, geometry: HitGeometry, kind?: 'datum' | 'segment', label?: string): unknown;
    selectedColor(id: string, color: string): string;
}
interface CrossSection { start: number; end: number; halfWidth: number }

/** Outline of the box, narrow whiskers, and caps; empty corners around a whisker stay unselectable. */
function summaryOutline(sections: readonly CrossSection[], center: number, horizontal: boolean): Point[] {
    const boundaries = [...new Set(sections.flatMap((section) => [section.start, section.end]))].sort((a, b) => a - b);
    const left: Point[] = [], right: Point[] = [];
    const point = (position: number, offset: number) => horizontal
        ? { x: position, y: center + offset }
        : { x: center + offset, y: position };
    for (let index = 1; index < boundaries.length; index++) {
        const start = boundaries[index - 1], end = boundaries[index], middle = start / 2 + end / 2;
        const halfWidth = Math.max(0, ...sections.filter((section) => section.start <= middle && section.end >= middle).map((section) => section.halfWidth));
        if (!halfWidth) continue;
        left.push(point(start, -halfWidth), point(end, -halfWidth));
        right.push(point(start, halfWidth), point(end, halfWidth));
    }
    return [...left, ...right.reverse()];
}

/** Consumes prepared statistics. Quartiles, whisker values, and outlier classification belong to the data source. */
export function drawBoxplotMarks(input: PaneGeometryInput, callbacks: BoxplotCallbacks): void {
    const { plan, pane, xb, yb, xs, ys, encode } = input;
    if (!plan.boxplot) throw new Error('source-contract-violation: boxplot role and group columns are required');
    const horizontal = barIsHorizontal(plan, yb),
        valueBinding = horizontal ? xb : yb,
        positionBinding = horizontal ? yb : xb,
        valueScale = horizontal ? xs : ys,
        positionScale = horizontal ? ys : xs,
        count = pane.seriesCount;
    if (!valueBinding) throw new Error('source-contract-violation: boxplot needs a numeric value axis');
    const groups = new Map<string, BoxplotGroup>();
    for (const record of [...pane.records].sort((a, b) => a.ordinal - b.ordinal)) {
        const value = record.values[valueBinding.columnKey];
        // Other measure slots use their own prepared statistic rows.
        if (value === null) continue;
        if (typeof value !== 'number' || !Number.isFinite(value))
            throw new Error('source-contract-violation: boxplot statistics must be finite numbers');
        const groupKey = record.values[plan.boxplot.groupKeyColumn], role = record.values[plan.boxplot.roleColumn];
        if (typeof groupKey !== 'string' || !groupKey.length)
            throw new Error('source-contract-violation: boxplot group keys must be nonempty strings');
        let group = groups.get(groupKey);
        if (!group) { group = { summaries: new Map(), outliers: [] }; groups.set(groupKey, group); }
        if (role === 'outlier') group.outliers.push(record);
        else if (summaryRoles.includes(role as SummaryRole)) {
            if (group.summaries.has(role as SummaryRole)) throw new Error(`source-contract-violation: duplicate boxplot ${role}`);
            group.summaries.set(role as SummaryRole, record);
        } else throw new Error('source-contract-violation: unknown boxplot role');
    }
    // Validate every group before painting any of them.
    for (const group of groups.values()) {
        const values = summaryRoles.map((role) => group.summaries.get(role)?.values[valueBinding.columnKey]);
        if (values.some((value) => value === undefined)) throw new Error('source-contract-violation: incomplete boxplot summary');
        if (Number(values[0]) > Number(values[4]) || Number(values[1]) > Number(values[2]) || Number(values[2]) > Number(values[3]))
            throw new Error('source-contract-violation: boxplot statistics must be ordered as lower <= upper and q1 <= median <= q3');
        if (group.outliers.some((record) => {
            const value = Number(record.values[valueBinding.columnKey]);
            return value >= Number(values[0]) && value <= Number(values[4]);
        })) throw new Error('source-contract-violation: boxplot outliers must lie outside the prepared whisker range');
        const records = [...group.summaries.values(), ...group.outliers], first = records[0];
        if (count === undefined || count < 1 || first.seriesOrdinal === undefined || first.seriesOrdinal < 0 || first.seriesOrdinal >= count)
            throw new Error('source-contract-violation: boxplots require complete series ordinals');
        const category = positionBinding ? positionCoordinate(positionBinding, first.values[positionBinding.columnKey]) : undefined;
        if (records.some((record) => record.seriesOrdinal !== first.seriesOrdinal ||
            (positionBinding && positionCoordinate(positionBinding, record.values[positionBinding.columnKey]) !== category)))
            throw new Error('source-contract-violation: boxplot summary group must share its category and series');
    }
    const lineWidth = plan.style?.lineWidth ?? 1.5;
    for (const [groupKey, group] of groups) {
        const records = summaryRoles.map((role) => group.summaries.get(role)!), median = records[2],
            style = encode(median.values), id = JSON.stringify(['boxplot', pane.key, groupKey]);
        const category = positionBinding ? positionCoordinate(positionBinding, median.values[positionBinding.columnKey]) : undefined;
        let center = positionScale.map(category);
        if (!Number.isFinite(center)) continue;
        const available = positionScale.type === 'band' ? positionScale.bandwidth * 0.72 : (plan.style?.barWidth ?? 12),
            slotWidth = available / count!, thickness = count! > 1 ? slotWidth * 0.9 : slotWidth;
        center += -available / 2 + slotWidth * (median.seriesOrdinal! + 0.5);
        const [lower, q1, middle, q3, upper] = records.map((record) => valueScale.map(record.values[valueBinding.columnKey]));
        if (![lower, q1, middle, q3, upper].every(Number.isFinite)) continue;
        const color = callbacks.selectedColor(id, style.color), opacity = style.opacity;
        const at = (position: number, offset = 0): Point => horizontal
            ? { x: position, y: center + offset }
            : { x: center + offset, y: position };
        const line = (name: string, a: Point, b: Point) => callbacks.add(`${id}:${name}`, {
            kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, width: lineWidth, opacity,
        }, id);
        if (opacity > 0 && thickness > 0) {
            const box: Box = horizontal
                ? { x: Math.min(q1, q3), y: center - thickness / 2, width: Math.abs(q3 - q1), height: thickness }
                : { x: center - thickness / 2, y: Math.min(q1, q3), width: thickness, height: Math.abs(q3 - q1) };
            callbacks.add(`${id}:box`, { kind: 'rect', box, fill: color, opacity: opacity * 0.25 }, id);
            line('q1-edge', at(q1, -thickness / 2), at(q1, thickness / 2));
            line('q3-edge', at(q3, -thickness / 2), at(q3, thickness / 2));
            line('left-edge', at(q1, -thickness / 2), at(q3, -thickness / 2));
            line('right-edge', at(q1, thickness / 2), at(q3, thickness / 2));
            line('median', at(middle, -thickness / 2), at(middle, thickness / 2));
            line('lower-whisker', at(lower), at(q1));
            line('upper-whisker', at(q3), at(upper));
            line('lower-cap', at(lower, -thickness / 4), at(lower, thickness / 4));
            line('upper-cap', at(upper, -thickness / 4), at(upper, thickness / 4));
            const strokeHalf = Math.max(1, lineWidth) / 2,
                sections: CrossSection[] = [
                    { start: Math.min(lower, q1, q3, upper) - strokeHalf, end: Math.max(lower, q1, q3, upper) + strokeHalf, halfWidth: strokeHalf },
                    { start: Math.min(q1, q3) - strokeHalf, end: Math.max(q1, q3) + strokeHalf, halfWidth: thickness / 2 + strokeHalf },
                    { start: lower - strokeHalf, end: lower + strokeHalf, halfWidth: thickness / 4 + strokeHalf },
                    { start: upper - strokeHalf, end: upper + strokeHalf, halfWidth: thickness / 4 + strokeHalf },
                ],
                points = summaryOutline(sections, center, horizontal),
                x = Math.min(...points.map((point) => point.x)), y = Math.min(...points.map((point) => point.y)),
                bounds = { x, y, width: Math.max(...points.map((point) => point.x)) - x, height: Math.max(...points.map((point) => point.y)) - y };
            const labels = ['lower', 'Q1', 'median', 'Q3', 'upper'];
            const label = `${valueBinding.label}: ` + records.map((record, index) => {
                const value = record.values[valueBinding.columnKey];
                return `${labels[index]}=${bindingValueLabel(valueBinding, toTypedValue(value)) ?? formatValue(value, valueScale.type, plan.axes?.[valueBinding.fieldRef]?.format)}`;
            }).join(', ');
            callbacks.hit(records, id, bounds, { kind: 'polygon', points }, 'segment', label);
        }
        for (const record of group.outliers) {
            const style = encode(record.values), radius = Math.sqrt(style.size / Math.PI),
                point = at(valueScale.map(record.values[valueBinding.columnKey])), outlierId = `${pane.key}:${record.datumKey}`;
            if (!radius || !style.opacity || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            callbacks.add(outlierId, { kind: 'circle', ...point, radius, fill: callbacks.selectedColor(outlierId, style.color), opacity: style.opacity });
            const box = { x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2 };
            callbacks.hit([record], outlierId, box, { kind: 'circle', ...point, radius });
        }
    }
}
