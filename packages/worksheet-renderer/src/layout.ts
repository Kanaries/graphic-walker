import { pathKey, valueKey } from './keys';
import type { AxisBranch, AxisGroup, AxisLayout, AxisLeaf, AxisScale, HeaderSpan, PathPart, Value, WorksheetSpec } from './types';

/** The only place layout sizes are defined. CSS px. */
export const metrics = {
    bandWidth: 28,
    bandHeight: 24,
    /** Member width when the marks are numbers rather than shapes. */
    textCellWidth: 76,
    legendMinWidth: 96,
    legendMaxWidth: 190,
    slotWidth: 200,
    slotHeight: 160,
    /** Side of the cell that holds one pie. */
    pieSize: 160,
    headerHeight: 24,
    captionHeight: 22,
    xAxisHeight: 40,
    headerMinWidth: 56,
    headerMaxWidth: 180,
    headerPadding: 6,
    rotatedLabelMax: 96,
    /** Inset of a continuous scale inside its slot, at the domain start and end. */
    scalePadStart: 2,
    scalePadEnd: 12,
    fontSize: 11,
    /** Share of a member step covered by a bar. */
    barFill: 0.7,
};

export interface LeafSizes { band: number; continuous: number }
export function leafSizes(spec: WorksheetSpec): { row: LeafSizes; column: LeafSizes } {
    // A pie fills a cell of its own, so every position is as large as an axis slot.
    if (spec.mark === 'arc') {
        const height = Math.max(48, spec.pane?.height ?? metrics.pieSize), width = Math.max(48, spec.pane?.width ?? metrics.pieSize);
        return { row: { band: height, continuous: height }, column: { band: width, continuous: width } };
    }
    return {
        row: { band: Math.max(12, spec.band?.height ?? metrics.bandHeight), continuous: Math.max(60, spec.pane?.height ?? metrics.slotHeight) },
        column: { band: Math.max(12, spec.band?.width ?? (spec.mark === 'text' ? metrics.textCellWidth : metrics.bandWidth)), continuous: Math.max(80, spec.pane?.width ?? metrics.slotWidth) },
    };
}

export type TextMeasure = (text: string, fontSize: number, fontWeight: number, font: string) => number;
export const defaultFont = 'system-ui, sans-serif';
let measure: TextMeasure | undefined;
let font = defaultFont;
/**
 * The font every width is measured in until the next call. Layout and scene building are
 * synchronous and each sets it on entry, so two sheets with different fonts do not mix.
 */
export function setFont(next?: string) { font = next || defaultFont; }
const measured = new Map<string, number>();
/**
 * Installs a real text measurer, for example a canvas context in the browser. Layout and
 * every backend read widths through textWidth, so they always agree. Without a measurer,
 * as in Node, widths are estimated from character counts.
 */
export function setTextMeasure(next?: TextMeasure) { measure = next; measured.clear(); }
export function textWidth(text: string, fontSize = metrics.fontSize, fontWeight = 400): number {
    if (measure) {
        const key = `${font}|${fontWeight}|${fontSize}|${text}`;
        let width = measured.get(key);
        if (width === undefined) {
            if (measured.size > 50_000) measured.clear();
            measured.set(key, width = measure(text, fontSize, fontWeight, font));
        }
        return width;
    }
    let width = 0;
    for (const char of text) width += char.codePointAt(0)! > 0x2e7f ? fontSize : fontSize * 0.58;
    return width;
}
export function fitText(text: string, width: number, fontSize = metrics.fontSize, fontWeight = 400): string {
    if (textWidth(text, fontSize, fontWeight) <= width) return text;
    let result = '';
    let used = textWidth('…', fontSize, fontWeight);
    for (const char of text) {
        used += textWidth(char, fontSize, fontWeight);
        if (used > width) break;
        result += char;
    }
    return result ? `${result}…` : '';
}

/**
 * Ticks at multiples of 1, 2 or 5 times a power of ten. The domain stays the data range,
 * so marks use the whole slot and the last tick may sit below the maximum.
 */
export function tickScale(min: number, max: number, pixels: number, gap: number, least = 2): AxisScale {
    if (min === max) { if (min > 0) min = 0; else if (min < 0) max = 0; else max = 1; }
    // At least `least` steps across the range, however little room there is.
    const raw = (max - min) / Math.max(least, Math.floor(pixels / gap));
    const power = 10 ** Math.floor(Math.log10(raw));
    const unit = raw / power;
    // Geometric midpoints between 1, 2, 5 and 10 pick the step nearest to the wanted spacing.
    const step = (unit < Math.SQRT2 ? 1 : unit < Math.sqrt(10) ? 2 : unit < Math.sqrt(50) ? 5 : 10) * power;
    const ticks: number[] = [];
    for (let i = Math.ceil(min / step - 1e-9); i <= Math.floor(max / step + 1e-9); i++) ticks.push(Number((i * step).toPrecision(12)));
    return { domain: [min, max], ticks };
}

export interface LeafDraft {
    id: string;
    groupId: string;
    branch: AxisBranch;
    path: PathPart[];
    kind: AxisLeaf['kind'];
}

// Orders leaves as a tree walk. Children of a node are bucketed by field, buckets follow
// branch order, members inside a bucket follow value order. This is a total order for any
// mix of concatenated branches, and it keeps the leaves under one header contiguous.
/** `parent` is the header path above the two members, which a per-parent order needs. */
export type MemberCompare = (instanceId: string, a: Value, b: Value, parent: PathPart[]) => number;
function orderLeaves(drafts: LeafDraft[], compare: MemberCompare): LeafDraft[] {
    const visit = (items: LeafDraft[], level: number): LeafDraft[] => {
        const buckets = new Map<string, { rank: number; terminal: boolean; items: LeafDraft[] }>();
        for (const item of items) {
            const part = item.path[level];
            // The member level of a band branch stays with its branch so that a pane's members are contiguous.
            const own = part && item.kind === 'band' && level === item.path.length - 1;
            const key = part ? `m:${part.instanceId}${own ? `:${item.branch.order}` : ''}` : `t:${item.branch.order}`;
            const bucket = buckets.get(key) ?? { rank: item.branch.order, terminal: !part, items: [] };
            bucket.rank = Math.min(bucket.rank, item.branch.order);
            bucket.items.push(item);
            buckets.set(key, bucket);
        }
        return [...buckets.values()].sort((a, b) => a.rank - b.rank || Number(a.terminal) - Number(b.terminal)).flatMap(bucket => {
            if (bucket.terminal) return bucket.items;
            const members = new Map<string, LeafDraft[]>();
            for (const item of bucket.items) {
                const key = valueKey(item.path[level].value);
                const list = members.get(key) ?? [];
                list.push(item);
                members.set(key, list);
            }
            const field = bucket.items[0].path[level].instanceId, parent = bucket.items[0].path.slice(0, level);
            return [...members.values()].sort((a, b) => compare(field, a[0].path[level].value, b[0].path[level].value, parent)).flatMap(list => visit(list, level + 1));
        });
    };
    return visit(drafts, 0);
}

export function buildAxis(axis: 'row' | 'column', drafts: Iterable<LeafDraft>, compare: MemberCompare, sizes: LeafSizes, instances: WorksheetSpec['instances']): AxisLayout {
    const leaves: AxisLeaf[] = [];
    const groups: AxisGroup[] = [];
    let offset = 0;
    for (const draft of orderLeaves([...drafts], compare)) {
        const size = draft.kind === 'continuous' ? sizes.continuous : sizes.band;
        let group = groups[groups.length - 1];
        if (!group || group.id !== draft.groupId) {
            group = { id: draft.groupId, index: groups.length, branch: draft.branch, path: draft.path.slice(0, draft.branch.facets.length), start: leaves.length, end: leaves.length, offset, size: 0 };
            groups.push(group);
        }
        leaves.push({ id: draft.id, index: leaves.length, branch: draft.branch, path: draft.path, kind: draft.kind, group: group.index, offset, size });
        group.end = leaves.length;
        group.size += size;
        offset += size;
    }
    const depth = Math.max(0, ...leaves.map(leaf => leaf.path.length));
    const levels: HeaderSpan[][] = [];
    const captions: string[] = [];
    for (let level = 0; level < depth; level++) {
        const spans: HeaderSpan[] = [];
        const names = new Set<string>();
        for (const leaf of leaves) {
            const part = leaf.path[level];
            if (!part) continue;
            names.add(instances[part.instanceId].label);
            const key = pathKey(axis, leaf.path.slice(0, level + 1));
            const open = spans[spans.length - 1];
            if (open && open.end === leaf.index && open.key === key) open.end = leaf.index + 1;
            else spans.push({ key, part, start: leaf.index, end: leaf.index + 1 });
        }
        levels.push(spans);
        captions.push([...names].join(', '));
    }
    return { axis, leaves, groups, levels, captions, size: offset };
}

/** Stretches or squeezes every leaf by the same factor, so members keep one shared step. */
export function scaleAxis(layout: AxisLayout, factor: number) {
    let offset = 0;
    for (const group of layout.groups) {
        group.offset = offset;
        for (let i = group.start; i < group.end; i++) {
            const leaf = layout.leaves[i];
            leaf.offset = offset;
            leaf.size *= factor;
            offset += leaf.size;
        }
        group.size = offset - group.offset;
    }
    layout.size = offset;
}

function lowerBound(length: number, before: (index: number) => boolean): number {
    let low = 0;
    let high = length;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (before(middle)) low = middle + 1; else high = middle;
    }
    return low;
}
/** Half-open range of leaves that intersect the logical interval [from, to). */
export function leafRange(layout: AxisLayout, from: number, to: number): [number, number] {
    const { leaves } = layout;
    const start = lowerBound(leaves.length, i => leaves[i].offset + leaves[i].size <= from);
    const end = lowerBound(leaves.length, i => leaves[i].offset < to);
    return [start, Math.max(start, end)];
}
/** Spans that intersect the half-open leaf range. */
export function spansIn(spans: HeaderSpan[], start: number, end: number): HeaderSpan[] {
    const first = lowerBound(spans.length, i => spans[i].end <= start);
    const last = lowerBound(spans.length, i => spans[i].start < end);
    return spans.slice(first, last);
}
