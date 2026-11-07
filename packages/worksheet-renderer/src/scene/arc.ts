import type { DisplayDomain, PaneRecord, PreparedRecord, RenderPlan, ScaleOptions } from '../core/types';
import { getDisplayDomain } from '../core/domains';
import type { PaneGeometryInput } from './marks';
import { numericChannel, resolveDomainValues } from './scales';
import type { ArcGeometry, Box, HitGeometry, Point, Primitive } from './types';

const turn = Math.PI * 2;
const epsilon = 1e-10;
export function arcPoint(arc: ArcGeometry, radius: number, angle: number): Point {
    return {
        x: arc.x + Math.cos(angle) * radius,
        y: arc.y + Math.sin(angle) * radius,
    };
}
export function angleInArc(arc: ArcGeometry, angle: number): boolean {
    if (arc.endAngle - arc.startAngle >= turn - epsilon) return true;
    const offset = (((angle - arc.startAngle) % turn) + turn) % turn;
    return offset <= arc.endAngle - arc.startAngle + epsilon || turn - offset <= epsilon;
}
export function pointInArc(arc: ArcGeometry, point: Point): boolean {
    const x = point.x - arc.x,
        y = point.y - arc.y,
        radius = Math.hypot(x, y);
    return (
        radius >= arc.innerRadius - epsilon &&
        radius <= arc.outerRadius + epsilon &&
        ((radius <= epsilon && arc.innerRadius === 0) || angleInArc(arc, Math.atan2(y, x)))
    );
}
/** Bounds include radial edges, inner endpoints, and every contained cardinal angle. */
export function arcBounds(arc: ArcGeometry): Box {
    const points = [
        arcPoint(arc, arc.outerRadius, arc.startAngle),
        arcPoint(arc, arc.outerRadius, arc.endAngle),
        arcPoint(arc, arc.innerRadius, arc.startAngle),
        arcPoint(arc, arc.innerRadius, arc.endAngle),
    ];
    for (let i = 0; i < 4; i++) if (angleInArc(arc, (i * Math.PI) / 2)) points.push(arcPoint(arc, arc.outerRadius, (i * Math.PI) / 2));
    const x = Math.min(...points.map((point) => point.x)),
        y = Math.min(...points.map((point) => point.y));
    return {
        x,
        y,
        width: Math.max(...points.map((point) => point.x)) - x,
        height: Math.max(...points.map((point) => point.y)) - y,
    };
}
/** Shared SVG path for the live backend and export. Full rings need two arcs per circumference. */
export function arcSvgPath(arc: ArcGeometry): string {
    if (
        ![arc.x, arc.y, arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle].every(Number.isFinite) ||
        arc.innerRadius < 0 ||
        arc.outerRadius < arc.innerRadius ||
        arc.endAngle < arc.startAngle ||
        arc.endAngle - arc.startAngle > turn + epsilon
    )
        throw new Error('source-contract-violation: invalid arc geometry');
    if (!arc.outerRadius || arc.innerRadius === arc.outerRadius || arc.endAngle === arc.startAngle) return '';
    const point = (radius: number, angle: number) => {
        const p = arcPoint(arc, radius, angle);
        return `${p.x},${p.y}`;
    };
    const outer = arc.outerRadius,
        inner = arc.innerRadius,
        start = arc.startAngle,
        end = arc.endAngle;
    if (end - start >= turn - epsilon) {
        const middle = start + Math.PI;
        const outside = `M${point(outer, start)} A${outer},${outer} 0 1 1 ${point(outer, middle)} A${outer},${outer} 0 1 1 ${point(outer, start)} Z`;
        return inner
            ? `${outside} M${point(inner, start)} A${inner},${inner} 0 1 0 ${point(inner, middle)} A${inner},${inner} 0 1 0 ${point(inner, start)} Z`
            : outside;
    }
    const large = end - start > Math.PI ? 1 : 0;
    return (
        `M${point(outer, start)} A${outer},${outer} 0 ${large} 1 ${point(outer, end)} ` +
        (inner ? `L${point(inner, end)} A${inner},${inner} 0 ${large} 0 ${point(inner, start)} Z` : `L${arc.x},${arc.y} Z`)
    );
}
interface ArcCallbacks {
    add(id: string, primitive: Primitive): unknown;
    hit(records: readonly PaneRecord[], id: string, box: Box, geometry: HitGeometry, kind?: 'datum' | 'segment'): unknown;
    selectedColor(id: string, color: string): string;
}
export function arcOuterLimit(plan: RenderPlan, plotWidth: number, plotHeight: number): number {
    const fitRadius = Math.max(0, Math.min(plotWidth, plotHeight) / 2);
    return Math.min(fitRadius, plan.style?.arcOuterRadius ?? fitRadius);
}
/** Pane marks and size legends use the same effective domain, area mapping and radius cap. */
export function createArcRadiusScale(
    channel: 'radius' | 'size', outerLimit: number, domain?: DisplayDomain, options?: ScaleOptions,
): { values?: readonly unknown[]; map(value: unknown): number } {
    const effective = { zero: true, ...options };
    return {
        values: domain ? resolveDomainValues(domain, effective) : undefined,
        map(raw) {
            if (raw === null) return 0;
            if (typeof raw !== 'number' || !Number.isFinite(raw))
                throw new Error(`invalid-value: arc ${channel} must be finite`);
            const value = domain
                ? numericChannel(raw, domain, effective, [0, channel === 'size' ? Math.PI * outerLimit * outerLimit : outerLimit])
                : raw;
            if (!Number.isFinite(value) || value < 0) throw new Error(`invalid-value: arc ${channel} range must be nonnegative`);
            return Math.min(outerLimit, channel === 'size' ? Math.sqrt(value / Math.PI) : value);
        },
    };
}
/** A pie is an angular layout of prepared nonnegative weights, with no data aggregation. */
export function drawArcMarks(input: PaneGeometryInput, callbacks: ArcCallbacks): void {
    const { plan, pane, plot, domains, encode } = input;
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const get = (name: 'theta' | 'radius' | 'size', record: PreparedRecord): unknown => {
        const channel = plan.channels?.[name];
        return !channel ? undefined : 'value' in channel ? channel.value : record[bindings.get(channel.fieldRef)!.columnKey];
    };
    const outerLimit = arcOuterLimit(plan, plot.width, plot.height),
        innerRadius = Math.min(outerLimit, plan.style?.arcInnerRadius ?? 0),
        x = plot.x + plot.width / 2,
        y = plot.y + plot.height / 2;
    const radialChannel = plan.channels?.radius ? 'radius' : plan.channels?.size ? 'size' : undefined;
    const channel = radialChannel && plan.channels?.[radialChannel];
    const radialBinding = channel && 'fieldRef' in channel ? bindings.get(channel.fieldRef)! : undefined;
    const radialDomain =
        radialBinding && radialChannel ? getDisplayDomain(plan, radialBinding.fieldRef, radialChannel, domains) : undefined;
    if (radialBinding && !radialDomain) throw new Error(`domain-unavailable: ${radialChannel} domain missing`);
    const radiusScale = radialChannel ? createArcRadiusScale(radialChannel, outerLimit, radialDomain,
        radialBinding ? plan.scales?.[radialBinding.fieldRef] : undefined) : undefined;
    const radius = (record: PreparedRecord) => {
        if (!radialChannel) return outerLimit;
        const raw = get(radialChannel, record);
        if (raw !== null && (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0))
            throw new Error(`invalid-value: arc ${radialChannel} must be finite and nonnegative`);
        return radiusScale!.map(raw);
    };
    const records = [...pane.records].sort((a, b) => a.ordinal - b.ordinal);
    // Validate before painting so one invalid weight cannot leave a misleading partial pie.
    const weighted = records.map((record) => {
        const raw = plan.channels?.theta ? get('theta', record.values) : 1;
        if (raw !== null && (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0))
            throw new Error('invalid-value: arc theta must be finite and nonnegative');
        return {
            record,
            weight: raw === null ? 0 : (raw as number),
            radius: radius(record.values),
        };
    });
    const maxWeight = weighted.reduce((max, item) => Math.max(max, item.weight), 0);
    if (!maxWeight || !outerLimit) return;
    // Scaling before the sum keeps finite but very large input weights representable.
    const total = weighted.reduce((sum, item) => sum + item.weight / maxWeight, 0);
    let angle = -Math.PI / 2;
    let last = weighted.length - 1;
    while (last >= 0 && weighted[last].weight === 0) last--;
    for (let index = 0; index < weighted.length; index++) {
        const { record, weight, radius: outerRadius } = weighted[index];
        if (!weight) continue;
        const endAngle = index === last ? Math.PI * 1.5 : angle + (weight / maxWeight / total) * turn;
        const geometry: HitGeometry = {
            kind: 'arc',
            x,
            y,
            innerRadius: Math.min(innerRadius, outerRadius),
            outerRadius,
            startAngle: angle,
            endAngle,
        };
        angle = endAngle;
        const style = encode(record.values);
        if (style.opacity === 0 || outerRadius <= innerRadius || geometry.endAngle <= geometry.startAngle) continue;
        const id = `${pane.key}:${record.datumKey}`;
        callbacks.add(id, {
            ...geometry,
            fill: callbacks.selectedColor(id, style.color),
            opacity: style.opacity,
        });
        callbacks.hit([record], id, arcBounds(geometry), geometry);
    }
}
