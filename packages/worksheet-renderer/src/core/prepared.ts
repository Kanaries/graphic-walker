import { axisLeafKey, decodeAxisLeafKey, headerKey, paneKey, pathKey, sameVersion, toTypedValue, typedValueKey, typedValueLabel } from './keys';
import { barIsHorizontal, bindingTypedValue, domainKeyFor, domainStorageKey, positionTypeFor } from './domains';
import { seriesIdentityFor, seriesKeyFor } from './series';
import type {
    Axis, AxisLeaf, AxisPlan, Diagnostic, DisplayDomain, HeaderSpan, MemberPath, PaneData, PaneRecord,
    PreparedDataSourceOptions, PreparedRecord, RankRange, ReadVersion, RenderDataSource, ResultBinding, TypedValue, DomainKey, SeriesDomain,
} from './types';

/** Contract failures are explicit so hosts can show a capability or data diagnostic. */
export class PreparedDataError extends Error {
    readonly diagnostic: Diagnostic;
    readonly code: string;
    constructor(code: string, message: string, fieldRef?: string) {
        super(message);
        this.name = 'PreparedDataError';
        this.code = code;
        this.diagnostic = { code, message, fieldRef, severity: 'error', recoverable: false };
    }
}

const MAX_AXIS_WINDOW = 100_000;
const MAX_PANE_WINDOWS = 64;
const MAX_UINT32 = 0xffffffff;
// The complete adapter is bounded independently of the much larger logical grid.
const MAX_INDEX_ENTRIES = 16_000_000;

export type BarStackState = Map<string, { positive: number; negative: number }>;

/** Pure rendering endpoints for supplied values. Domain preparation and scene use this rule. */
export function advanceBarStack(stacks: BarStackState, position: unknown, value: number): { start: number; end: number } {
    const key = position === undefined ? '["default-position"]' : typedValueKey(toTypedValue(position, Array.isArray(position) ? 'interval' : undefined));
    const state = stacks.get(key) ?? { positive: 0, negative: 0 };
    const start = value >= 0 ? state.positive : state.negative;
    const end = start + value;
    if (!Number.isFinite(end)) fail('invalid-value', 'Stacked rendering endpoints must remain finite.');
    if (value >= 0) state.positive = end;
    else state.negative = end;
    stacks.set(key, state);
    return { start, end };
}

function fail(code: string, message: string, fieldRef?: string): never {
    throw new PreparedDataError(code, message, fieldRef);
}

function checkAbort(signal: AbortSignal): void {
    if (signal.aborted) {
        const error = new Error('The data read was aborted.');
        error.name = 'AbortError';
        throw error;
    }
}

function checkRange(range: RankRange, length: number): void {
    if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start || range.end > length) {
        fail('source-contract-violation', `Invalid half-open rank range [${range.start}, ${range.end}) for ${length} positions.`);
    }
}

function lowerBound(values: ArrayLike<number>, target: number, start = 0, end = values.length): number {
    while (start < end) {
        const middle = start + Math.floor((end - start) / 2);
        if (values[middle] < target) start = middle + 1;
        else end = middle;
    }
    return start;
}

function frozenPath(path: MemberPath): MemberPath {
    return Object.freeze(path.map((member) => Object.freeze({ fieldRef: member.fieldRef,
        value: Object.freeze(member.value.type === 'interval' ? { ...member.value, start: Object.freeze({ ...member.value.start }), end: Object.freeze({ ...member.value.end }) } : { ...member.value }) })));
}

interface Node {
    path: MemberPath;
    children: Map<string, Node>;
    start: number;
    end: number;
    terminal: boolean;
    collapsed: boolean;
}
interface AxisIndex {
    leaves: readonly AxisLeaf[];
    byKey: ReadonlyMap<string, AxisLeaf>;
    headers: readonly (readonly HeaderSpan[])[];
    recordBases: Uint32Array;
    slotCount: number;
    nodes: ReadonlyMap<string, Node>;
    headerByKey: ReadonlyMap<string, HeaderSpan>;
}

function valueFor(record: PreparedRecord, binding: ResultBinding): unknown {
    if (!Object.prototype.hasOwnProperty.call(record, binding.columnKey) || record[binding.columnKey] === undefined) {
        fail('missing-binding', `Prepared record is missing column ${JSON.stringify(binding.columnKey)}.`, binding.fieldRef);
    }
    return record[binding.columnKey];
}

function typedFor(record: PreparedRecord, binding: ResultBinding): TypedValue {
    try {
        return bindingTypedValue(binding, valueFor(record, binding));
    } catch (error) {
        if (error instanceof PreparedDataError) throw error;
        return fail('invalid-value', error instanceof Error ? error.message : 'Invalid prepared value.', binding.fieldRef);
    }
}

function createAxisIndex(axis: Axis, axisPlan: AxisPlan, records: readonly PreparedRecord[], bindings: ReadonlyMap<string, ResultBinding>, options: PreparedDataSourceOptions): AxisIndex {
    const root: Node = { path: Object.freeze([]), children: new Map(), start: 0, end: 0, terminal: false, collapsed: false };
    const nodes = new Map<string, Node>([[pathKey([]), root]]);
    const validatePath = (path: MemberPath): void => {
        if (!Array.isArray(path) || path.length > axisPlan.facets.length) fail('source-contract-violation', 'Prepared path exceeds the axis facet depth.');
        path.forEach((member, depth) => { if (member.fieldRef !== axisPlan.facets[depth]) fail('source-contract-violation', 'Prepared path does not match the axis field order.'); typedValueKey(member.value); });
    };
    // Intern actual members while reading records. Each record stores one node index,
    // rather than allocating a second full path and JSON path key for every occurrence.
    const nodeList: Node[] = [root], nodeIds = new Map<Node, number>([[root, 0]]);
    const recordNodes = new Uint32Array(records.length);
    const explicit = options.axisMembers?.[axis];
    const fieldBindings = axisPlan.facets.map(fieldRef => bindings.get(fieldRef)!);
    const valueCaches = fieldBindings.map(() => new Map<unknown, { value: TypedValue; key: string }>());
    const preparedMember = (record: PreparedRecord, depth: number) => {
        const binding = fieldBindings[depth], raw = valueFor(record, binding), cache = valueCaches[depth];
        let found = cache.get(raw);
        if (!found) {
            const value = typedFor(record, binding);
            found = { value, key: typedValueKey(value) }; cache.set(raw, found);
        }
        return found;
    };
    const childFor = (node: Node | undefined, fieldRef: string, value: TypedValue, key: string, create: boolean): Node | undefined => {
        if (!node) return undefined;
        let child = node.children.get(key);
        if (!child && create) {
            // Frozen prefix members can safely be shared by all descendant paths.
            const member = frozenPath([{ fieldRef, value }])[0];
            child = { path: Object.freeze([...node.path, member]), children: new Map(), start: 0, end: 0, terminal: false, collapsed: false };
            node.children.set(key, child); nodes.set(pathKey(child.path), child);
            nodeIds.set(child, nodeList.length); nodeList.push(child);
        }
        return child;
    };
    for (const member of explicit ?? []) {
        validatePath(member.path); let node = root;
        for (const { fieldRef, value } of member.path) node = childFor(node, fieldRef, value, typedValueKey(value), true)!;
        if (node.terminal) fail('source-contract-violation', 'Explicit visible member paths must be unique.');
        node.terminal = true; node.collapsed = member.collapsed ?? member.path.length < axisPlan.facets.length;
    }
    for (let ordinal = 0; ordinal < records.length; ordinal++) {
        const record = records[ordinal]; let node: Node | undefined = root;
        if (options.getRecordPath) {
            const path = options.getRecordPath(options.records[ordinal], ordinal, axis); validatePath(path);
            for (let depth = 0; depth < path.length; depth++) {
                const member = path[depth], actual = preparedMember(record, depth), key = typedValueKey(member.value);
                if (actual.key !== key) fail('source-contract-violation', 'Prepared record does not match its declared member path.', member.fieldRef);
                node = childFor(node, member.fieldRef, actual.value, key, !explicit);
            }
        } else {
            for (let depth = 0; depth < fieldBindings.length; depth++) {
                const member = preparedMember(record, depth);
                node = childFor(node, fieldBindings[depth].fieldRef, member.value, member.key, !explicit);
            }
        }
        if (node && !explicit) { node.terminal = true; node.collapsed = node.path.length < axisPlan.facets.length; }
        recordNodes[ordinal] = node && node.terminal ? nodeIds.get(node)! : MAX_UINT32;
    }
    if (!records.length && !explicit && !axisPlan.facets.length) root.terminal = true;
    // Caches are preparation-only; retaining them would duplicate the immutable member tree.
    valueCaches.forEach(cache => cache.clear()); nodeIds.clear();
    const order = new Map<string, ReadonlyMap<string, number>>();
    for (const item of options.memberOrder ?? []) {
        if (item.axis !== axis) continue;
        if (axisPlan.facets[item.parent.length] !== item.fieldRef) fail('source-contract-violation', 'Member order does not match the axis field at its parent depth.', item.fieldRef);
        const key = pathKey(item.parent);
        if (order.has(key)) fail('source-contract-violation', 'Duplicate member order for one parent path.', item.fieldRef);
        const ordinals = new Map<string, number>();
        item.values.forEach((value, index) => {
            const memberKey = typedValueKey(value);
            if (ordinals.has(memberKey)) fail('source-contract-violation', 'Duplicate typed member in explicit member order.', item.fieldRef);
            ordinals.set(memberKey, index);
        });
        order.set(key, ordinals);
    }
    const leaves: AxisLeaf[] = [];
    const headers: HeaderSpan[][] = Array.from({ length: axisPlan.facets.length + 1 }, () => []);
    const positions: readonly (string | undefined)[] = axisPlan.positions.length ? axisPlan.positions : [undefined];
    const append = (node: Node): void => {
        node.start = leaves.length;
        if (node.terminal) {
            if (node.children.size) fail('source-contract-violation', 'Visible leaves cannot contain an ancestor and its descendants.');
            for (const positionRef of positions) {
                const slotId = JSON.stringify(['slot', axis, positionRef ?? null]);
                const sharedBand = positionRef && positionTypeFor(bindings.get(positionRef)!) === 'band' && (!options.plan.scales?.[positionRef]?.scope || options.plan.scales[positionRef].scope!.mode === 'shared');
                const leaf = Object.freeze({ key: axisLeafKey(axis, node.path, slotId), rank: leaves.length, path: node.path, slotId, positionRef, collapsed: node.collapsed,
                    bandDomainId: sharedBand ? JSON.stringify(['domain', options.version, positionRef]) : undefined });
                leaves.push(leaf);
                if (axisPlan.positions.length > 1) {
                    headers[node.path.length].push(Object.freeze({ key: JSON.stringify(['slot-header', leaf.key]), kind: 'slot' as const,
                        parentKey: node.path.length ? headerKey(axis, node.path) : undefined, path: node.path, depth: node.path.length,
                        start: leaf.rank, end: leaf.rank + 1, label: bindings.get(positionRef!)!.label }));
                }
            }
        } else {
            const children = [...node.children.values()];
            const ordinals = order.get(pathKey(node.path));
            if (ordinals) children.sort((a, b) => (ordinals.get(typedValueKey(a.path[a.path.length - 1].value)) ?? Infinity) - (ordinals.get(typedValueKey(b.path[b.path.length - 1].value)) ?? Infinity));
            children.forEach(append);
        }
        node.end = leaves.length;
        if (node.path.length && node.end > node.start) {
            headers[node.path.length - 1].push(Object.freeze({ key: headerKey(axis, node.path), kind: 'member' as const, expanded: node.collapsed ? false : node.children.size ? true : undefined,
                parentKey: node.path.length > 1 ? headerKey(axis, node.path.slice(0, -1)) : undefined,
                path: node.path, depth: node.path.length - 1, start: node.start, end: node.end,
                label: typedValueLabel(node.path[node.path.length - 1].value) }));
        }
    };
    append(root);
    if (leaves.length > MAX_UINT32) fail('resource-limit', 'The prepared axis exceeds the 32-bit rank index.');
    const recordBases = recordNodes;
    for (let index = 0; index < recordBases.length; index++) if (recordBases[index] !== MAX_UINT32) recordBases[index] = nodeList[recordBases[index]].start;
    return { leaves: Object.freeze(leaves), byKey: new Map(leaves.map((leaf) => [leaf.key, leaf])),
        headers: Object.freeze(headers.map((level) => Object.freeze(level.sort((a, b) => a.start - b.start)))), recordBases, slotCount: positions.length,
        nodes, headerByKey: new Map(headers.flat().map((header) => [header.key, header])) };
}

function readHeaders(index: AxisIndex, range: RankRange): readonly HeaderSpan[] {
    if (range.start === range.end) return [];
    const result: HeaderSpan[] = [];
    for (const level of index.headers) {
        let start = 0;
        let end = level.length;
        while (start < end) {
            const middle = start + Math.floor((end - start) / 2);
            if (level[middle].end <= range.start) start = middle + 1;
            else end = middle;
        }
        for (let cursor = start; cursor < level.length && level[cursor].start < range.end; cursor++) result.push(level[cursor]);
    }
    return result;
}

/**
 * Index prepared records, actual visible member paths, and complete display domains.
 * It performs no aggregation, filtering, expression evaluation, or data preparation.
 */
export function createPreparedDataSource(options: PreparedDataSourceOptions): RenderDataSource {
    // Resolved rendering parameters belong to this immutable source presentation.
    const plan: PreparedDataSourceOptions['plan'] = structuredClone(options.plan);
    const domainPlanKey = plan.domainPlanKey;
    const version: ReadVersion = Object.freeze({ ...options.version });
    for (const value of Object.values(version)) if (typeof value !== 'string' || !value) fail('source-contract-violation', 'Every ReadVersion identifier must be a non-empty string.');
    if (typeof domainPlanKey !== 'string' || !domainPlanKey) fail('source-contract-violation', 'The domain plan key must be a non-empty string.');
    if (options.identityScope === 'stable' && !options.getDatumKey) fail('unstable-datum-identity', 'Stable identity requires a host-provided datum key.');
    if (options.records.length > MAX_UINT32) fail('resource-limit', 'The prepared input exceeds the 32-bit record index.');
    const bindings = new Map<string, ResultBinding>();
    for (const binding of plan.bindings) {
        if (!binding.fieldRef || bindings.has(binding.fieldRef)) fail('source-contract-violation', 'Binding fieldRef values must be non-empty and unique.', binding.fieldRef);
        bindings.set(binding.fieldRef, binding);
    }
    const references = [...plan.rows.facets, ...plan.rows.positions, ...plan.columns.facets, ...plan.columns.positions, ...(plan.channels?.details ?? [])];
    for (const channel of Object.values(plan.channels ?? {})) if (channel && !Array.isArray(channel) && 'fieldRef' in channel) references.push(channel.fieldRef);
    for (const fieldRef of references) if (!bindings.has(fieldRef)) fail('missing-binding', 'The render plan references a missing result binding.', fieldRef);
    for (const axis of [plan.rows, plan.columns]) {
        if (new Set(axis.facets).size !== axis.facets.length || new Set(axis.positions).size !== axis.positions.length) fail('source-contract-violation', 'Repeated field occurrences require distinct fieldRef values.');
    }
    const upperEntryCount = options.records.length * Math.max(1, plan.rows.positions.length) * Math.max(1, plan.columns.positions.length);
    if (!Number.isSafeInteger(upperEntryCount) || upperEntryCount > MAX_INDEX_ENTRIES) fail('resource-limit', `Prepared inputs are limited to ${MAX_INDEX_ENTRIES} record-to-slot index entries.`);
    const records: PreparedRecord[] = options.records.map((record) => {
        const copy: Record<string, unknown> = { ...record };
        for (const key of Object.keys(copy)) if (Array.isArray(copy[key])) copy[key] = Object.freeze([...(copy[key] as unknown[])]);
        return Object.freeze(copy);
    });
    const keys = new Set<string>();
    const recordOrdinals = new Set<number>();
    const paneRecords: readonly PaneRecord[] = Object.freeze(records.map((record, inputIndex) => {
        const datumKey = options.getDatumKey ? options.getDatumKey(options.records[inputIndex], inputIndex) : JSON.stringify(['datum', version.sourceId, version.snapshotId, inputIndex]);
        const ordinal = options.getOrdinal ? options.getOrdinal(options.records[inputIndex], inputIndex) : inputIndex;
        const sequenceOrder = options.getSequenceOrder?.(options.records[inputIndex], inputIndex);
        if (!Number.isSafeInteger(ordinal) || ordinal < 0 || recordOrdinals.has(ordinal)) fail('source-contract-violation', 'Prepared ordinals must be unique non-negative safe integers.');
        if (sequenceOrder !== undefined && !Number.isFinite(sequenceOrder)) fail('source-contract-violation', 'Explicit sequenceOrder must be finite.');
        if (options.getOrdinal) recordOrdinals.add(ordinal);
        if (typeof datumKey !== 'string' || !datumKey) fail('unstable-datum-identity', 'Datum keys must be non-empty strings.');
        if (keys.has(datumKey)) fail('unstable-datum-identity', 'Prepared records must have unique datum keys.');
        keys.add(datumKey);
        return Object.freeze({ datumKey, ordinal, values: record, ...(sequenceOrder === undefined ? {} : { sequenceOrder }) });
    }));
    keys.clear(); recordOrdinals.clear();
    const rowIndex = createAxisIndex('row', plan.rows, records, bindings, options);
    const columnIndex = createAxisIndex('column', plan.columns, records, bindings, options);
    const visibleRecordIndices: number[] = [];
    for (let index = 0; index < records.length; index++) if (rowIndex.recordBases[index] !== MAX_UINT32 && columnIndex.recordBases[index] !== MAX_UINT32) visibleRecordIndices.push(index);
    const recordSeries = new Uint32Array(records.length), seenSeries = new Map<string, number>();
    const seriesColor = plan.channels?.color, seriesShape = plan.channels?.shape;
    const hasSeriesFields = !!plan.channels?.details?.length
        || !!seriesColor && 'fieldRef' in seriesColor && positionTypeFor(bindings.get(seriesColor.fieldRef)!) === 'band'
        || plan.mark === 'point' && !!seriesShape && 'fieldRef' in seriesShape;
    const emptySeries = hasSeriesFields ? undefined : seriesIdentityFor(plan, {});
    const seriesInputOrder = options.getOrdinal ? [...visibleRecordIndices].sort((a, b) => paneRecords[a].ordinal - paneRecords[b].ordinal) : visibleRecordIndices;
    for (const index of seriesInputOrder) {
        const identity = emptySeries ?? seriesIdentityFor(plan, records[index]);
        let ordinal = seenSeries.get(identity);
        if (ordinal === undefined) { ordinal = seenSeries.size; seenSeries.set(identity, ordinal); }
        recordSeries[index] = ordinal;
    }
    if (options.seriesOrder && new Set(options.seriesOrder).size !== options.seriesOrder.length) fail('source-contract-violation', 'Explicit series order contains duplicate identities.');
    const orderedSeries = new Set(options.seriesOrder ?? []);
    const seriesKeys = [...(options.seriesOrder ?? []).filter((key) => seenSeries.has(key)), ...[...seenSeries.keys()].filter((key) => !orderedSeries.has(key))];
    const seriesOrdinals = new Map(seriesKeys.map((key, index) => [key, index]));
    const remapSeries = new Uint32Array(seenSeries.size);
    for (const [identity, ordinal] of seenSeries) remapSeries[ordinal] = seriesOrdinals.get(identity)!;
    for (const index of visibleRecordIndices) recordSeries[index] = remapSeries[recordSeries[index]];
    const series: SeriesDomain = Object.freeze({ domainId: JSON.stringify(['series-domain', version, domainPlanKey]), keys: Object.freeze(seriesKeys), complete: options.complete !== false });
    const entryCount = visibleRecordIndices.length * rowIndex.slotCount * columnIndex.slotCount;
    const rows = new Uint32Array(entryCount);
    const columns = new Uint32Array(entryCount);
    const ordinals = new Uint32Array(entryCount);
    let entry = 0;
    for (const ordinal of visibleRecordIndices) {
        for (let rowSlot = 0; rowSlot < rowIndex.slotCount; rowSlot++) {
            for (let columnSlot = 0; columnSlot < columnIndex.slotCount; columnSlot++) {
                rows[entry] = rowIndex.recordBases[ordinal] + rowSlot;
                columns[entry] = columnIndex.recordBases[ordinal] + columnSlot;
                ordinals[entry++] = ordinal;
            }
        }
    }
    const sorted = new Uint32Array(entryCount);
    let sortedAlready = true;
    for (let index = 0; index < entryCount; index++) {
        sorted[index] = index;
        if (index && (rows[index - 1] > rows[index] || rows[index - 1] === rows[index] && (columns[index - 1] > columns[index]
            || columns[index - 1] === columns[index] && paneRecords[ordinals[index - 1]].ordinal > paneRecords[ordinals[index]].ordinal))) sortedAlready = false;
    }
    if (!sortedAlready) sorted.sort((a, b) => rows[a] - rows[b] || columns[a] - columns[b] || paneRecords[ordinals[a]].ordinal - paneRecords[ordinals[b]].ordinal);
    const sortedColumns = new Uint32Array(entryCount);
    const sortedOrdinals = new Uint32Array(entryCount);
    const nonEmptyRows: number[] = [];
    const rowOffsets: number[] = [];
    let nonEmptyPaneCount = 0;
    let lastRow = -1;
    let lastColumn = -1;
    for (let index = 0; index < sorted.length; index++) {
        const from = sorted[index];
        const row = rows[from];
        const column = columns[from];
        sortedColumns[index] = column;
        sortedOrdinals[index] = ordinals[from];
        if (row !== lastRow) {
            nonEmptyRows.push(row);
            rowOffsets.push(index);
        }
        if (row !== lastRow || column !== lastColumn) nonEmptyPaneCount++;
        lastRow = row;
        lastColumn = column;
    }
    rowOffsets.push(entryCount);
    const occupiedRows = Uint32Array.from(nonEmptyRows);
    const offsets = Uint32Array.from(rowOffsets);
    const complete = options.complete !== false;
    const stackedExtents = new Map<string, { minimum: number; maximum: number }>();
    const scopedGroups = new Map<string, { key: DomainKey; indices: Set<number>; extent?: { minimum: number; maximum: number } }>();
    const hasScopedPositions = [...plan.rows.positions, ...plan.columns.positions].some(ref => plan.scales?.[ref]?.scope && plan.scales[ref].scope!.mode !== 'shared');
    if (hasScopedPositions) for (let index = 0; index < sorted.length; index++) {
        const from = sorted[index], row = rowIndex.leaves[rows[from]], column = columnIndex.leaves[columns[from]];
        for (const [ref, channel] of [[column.positionRef, 'x'], [row.positionRef, 'y']] as const) {
            if (!ref || !plan.scales?.[ref]?.scope || plan.scales[ref].scope!.mode === 'shared') continue;
            const key = domainKeyFor(plan, ref, channel, row, column);
            if (key.scope.mode === 'shared') continue;
            const storage = domainStorageKey(key);
            let group = scopedGroups.get(storage);
            if (!group) { group = { key, indices: new Set() }; scopedGroups.set(storage, group); }
            group.indices.add(ordinals[from]);
        }
    }
    const stackedFields = new Set<string>();
    if (plan.mark === 'bar' && plan.stack === 'zero') {
        for (const rowRef of plan.rows.positions.length ? plan.rows.positions : [undefined]) {
            for (const columnRef of plan.columns.positions.length ? plan.columns.positions : [undefined]) {
                const xBinding = bindings.get(columnRef ?? '');
                const yBinding = bindings.get(rowRef ?? '');
                const horizontal = barIsHorizontal(plan, yBinding);
                const valueBinding = horizontal ? xBinding : yBinding;
                if (valueBinding) stackedFields.add(valueBinding.fieldRef);
            }
        }
        let previousRow = -1;
        let previousColumn = -1;
        let stacks: BarStackState = new Map();
        const stackOrder = Uint32Array.from(sorted);
        stackOrder.sort((a, b) => rows[a] - rows[b] || columns[a] - columns[b]
            || recordSeries[ordinals[a]] - recordSeries[ordinals[b]]
            || paneRecords[ordinals[a]].ordinal - paneRecords[ordinals[b]].ordinal);
        for (let index = 0; index < stackOrder.length; index++) {
            const from = stackOrder[index];
            const rowRank = rows[from];
            const columnRank = columns[from];
            if (rowRank !== previousRow || columnRank !== previousColumn) stacks = new Map();
            previousRow = rowRank;
            previousColumn = columnRank;
            const xBinding = bindings.get(columnIndex.leaves[columnRank].positionRef ?? '');
            const yBinding = bindings.get(rowIndex.leaves[rowRank].positionRef ?? '');
            const horizontal = barIsHorizontal(plan, yBinding);
            const valueBinding = horizontal ? xBinding : yBinding;
            const positionBinding = horizontal ? yBinding : xBinding;
            if (!valueBinding) continue;
            const record = records[ordinals[from]];
            const value = valueFor(record, valueBinding);
            const position = positionBinding ? valueFor(record, positionBinding) : undefined;
            if (value === null || position === null && positionBinding && positionTypeFor(positionBinding) !== 'band') continue;
            if (typeof value !== 'number' || !Number.isFinite(value)) fail('invalid-value', 'Bar values must be finite prepared numbers or null.', valueBinding.fieldRef);
            const { start, end } = advanceBarStack(stacks, position, value);
            const extent = stackedExtents.get(valueBinding.fieldRef) ?? { minimum: 0, maximum: 0 };
            extent.minimum = Math.min(extent.minimum, start, end);
            extent.maximum = Math.max(extent.maximum, start, end);
            stackedExtents.set(valueBinding.fieldRef, extent);
            const key = domainKeyFor(plan, valueBinding.fieldRef, horizontal ? 'x' : 'y', rowIndex.leaves[rowRank], columnIndex.leaves[columnRank]);
            const scoped = scopedGroups.get(domainStorageKey(key));
            if (scoped) {
                const extent = scoped.extent ?? { minimum: 0, maximum: 0 };
                extent.minimum = Math.min(extent.minimum, start, end);
                extent.maximum = Math.max(extent.maximum, start, end);
                scoped.extent = extent;
            }
        }
    }
    const domains: Record<string, DisplayDomain> = Object.create(null);
    const requiredValues = new Set([...plan.rows.positions, ...plan.columns.positions, ...(plan.channels?.details ?? [])]);
    for (const channel of Object.values(plan.channels ?? {})) if (channel && !Array.isArray(channel) && 'fieldRef' in channel) requiredValues.add(channel.fieldRef);
    const buildDomain = (binding: ResultBinding, indices: Iterable<number>, key?: DomainKey, stacked?: { minimum: number; maximum: number }): DisplayDomain => {
        const type = positionTypeFor(binding);
        const values: unknown[] = [];
        const seen = new Set<string>(), seenPrimitives = new Set<unknown>();
        let minimum = Infinity;
        let maximum = -Infinity;
        for (const index of indices) {
            const record = records[index];
            if (!requiredValues.has(binding.fieldRef) && !Object.prototype.hasOwnProperty.call(record, binding.columnKey)) continue;
            const value = valueFor(record, binding);
            if (type === 'band') {
                // Repeated primitive members were already validated and canonically encoded.
                if (!Array.isArray(value) && seenPrimitives.has(value)) continue;
                const key = typedValueKey(typedFor(record, binding));
                if (!Array.isArray(value)) seenPrimitives.add(value);
                if (!seen.has(key)) { seen.add(key); values.push(value); }
            } else if (value !== null) {
                typedFor(record, binding);
                if (binding.valueType === 'interval') {
                    const [start, end] = value as readonly number[]; minimum = Math.min(minimum, start); maximum = Math.max(maximum, end);
                } else {
                    if (typeof value !== 'number' || !Number.isFinite(value)) fail('invalid-value', 'Continuous coordinates must be finite prepared numbers or null.', binding.fieldRef);
                    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
                }
            }
        }
        if (stackedFields.has(binding.fieldRef)) { minimum = Infinity; maximum = -Infinity; }
        if (stacked) { minimum = stacked.minimum; maximum = stacked.maximum; }
        const empty = type === 'band' ? values.length === 0 : minimum === Infinity;
        const scale = plan.scales?.[binding.fieldRef];
        let domain: readonly unknown[] = type === 'band' ? values : empty ? [0, 1] : [minimum, maximum];
        if (scale?.domain) domain = [...scale.domain];
        if (type !== 'band') {
            if (domain.length !== 2 || domain.some((value) => typeof value !== 'number' || !Number.isFinite(value))) fail('invalid-domain', 'A continuous domain requires two finite endpoints.', binding.fieldRef);
            domain = [scale?.domainMin ?? domain[0], scale?.domainMax ?? domain[1]];
            if (domain.some((value) => typeof value !== 'number' || !Number.isFinite(value)) || (domain[0] as number) > (domain[1] as number)) fail('invalid-domain', 'Continuous domain endpoints must be finite and ordered.', binding.fieldRef);
        } else {
            const unique = new Set<string>();
            for (const value of domain) {
                const key = typedValueKey(bindingTypedValue(binding, value));
                if (unique.has(key)) fail('invalid-domain', 'A band domain must contain unique typed values.', binding.fieldRef);
                unique.add(key);
            }
        }
        const fixed = !!scale?.domain || type !== 'band' && scale?.domainMin !== undefined && scale.domainMax !== undefined;
        if (type === 'time' && domain.some((value) => Math.abs(value as number) > 8_640_000_000_000_000)) fail('invalid-domain', 'Time domain exceeds the supported epoch range.', binding.fieldRef);
        return Object.freeze({ fieldRef: binding.fieldRef,
            domainId: JSON.stringify(['domain', version, key ? domainStorageKey(key) : binding.fieldRef]), type, values: Object.freeze(domain),
            complete: complete || fixed, extentKind: stackedFields.has(binding.fieldRef) ? 'stacked' : 'value', empty, source: fixed ? 'fixed' : 'prepared', ...(key ? { key } : {}) });
    };
    for (const binding of plan.bindings) domains[binding.fieldRef] = buildDomain(binding, visibleRecordIndices, undefined, stackedExtents.get(binding.fieldRef));
    for (const [storage, group] of scopedGroups) {
        domains[storage] = buildDomain(bindings.get(group.key.fieldRef)!, group.indices, group.key, group.extent);
    }
    const manifest = Object.freeze({ version, domainPlanKey, rowLeafCount: rowIndex.leaves.length,
        columnLeafCount: columnIndex.leaves.length, recordCount: records.length, nonEmptyPaneCount,
        status: complete ? 'complete' as const : 'preview' as const,
        identityScope: options.identityScope ?? (options.getDatumKey ? 'stable' as const : 'snapshot' as const),
        capabilities: Object.freeze({ randomAxisAccess: true, locateByKey: true, maxAxisWindow: MAX_AXIS_WINDOW,
            maxPaneWindows: MAX_PANE_WINDOWS, domainPlanKeys: Object.freeze([domainPlanKey]) }) });
    const begin = (requested: ReadVersion, signal: AbortSignal): void => {
        checkAbort(signal);
        if (!sameVersion(version, requested)) fail('version-expired', 'This source cannot read the requested version.');
    };
    const source: RenderDataSource = {
        version,
        async describe(signal) { checkAbort(signal); return manifest; },
        async readAxis(request, signal) {
            begin(request.version, signal);
            const index = request.axis === 'row' ? rowIndex : columnIndex;
            checkRange(request.range, index.leaves.length);
            if (request.range.end - request.range.start > MAX_AXIS_WINDOW) fail('resource-limit', `Axis reads are limited to ${MAX_AXIS_WINDOW} positions.`);
            return { version, axis: request.axis, range: { ...request.range }, leaves: index.leaves.slice(request.range.start, request.range.end), ancestors: readHeaders(index, request.range) };
        },
        async locate(request, signal) {
            begin(request.version, signal);
            const index = request.axis === 'row' ? rowIndex : columnIndex;
            const leaf = index.byKey.get(request.key);
            if (!leaf) {
                const decoded = decodeAxisLeafKey(request.key), path = request.path ?? decoded?.path;
                if (decoded?.axis === request.axis && path && pathKey(decoded.path) === pathKey(path)) {
                    for (let depth = path.length - 1; depth > 0; depth--) {
                        const node = index.nodes.get(pathKey(path.slice(0, depth)));
                        if (node?.terminal && node.collapsed) {
                            const ancestor = index.headerByKey.get(headerKey(request.axis, node.path));
                            if (ancestor) return { version, status: 'hidden', ancestor };
                        }
                    }
                }
                return { version, status: 'missing' };
            }
            if (request.path && pathKey(request.path) !== pathKey(leaf.path)) fail('source-contract-violation', 'The requested leaf key and path disagree.');
            return { version, status: 'found', rank: leaf.rank, leaf };
        },
        async readDomains(request, signal) {
            begin(request.version, signal);
            const selected: Record<string, DisplayDomain> = Object.create(null);
            for (const fieldRef of request.fieldRefs) {
                if (!domains[fieldRef]) fail('domain-unavailable', 'The requested field domain does not exist.', fieldRef);
                selected[fieldRef] = domains[fieldRef];
            }
            for (const key of request.keys ?? []) {
                if (key.domainPlanKey !== domainPlanKey || !bindings.has(key.fieldRef)) fail('domain-unavailable', 'Unknown domain plan or field binding.');
                let row: AxisLeaf | undefined, column: AxisLeaf | undefined;
                if (key.scope.mode === 'pane') {
                    try { const parsed = JSON.parse(key.scope.paneKey); if (parsed[0] === 'pane') { row = rowIndex.byKey.get(parsed[1]); column = columnIndex.byKey.get(parsed[2]); } } catch { /* Rejected below. */ }
                    if (!row || !column || paneKey(row.key, column.key) !== key.scope.paneKey) fail('domain-unavailable', 'Unknown pane domain.');
                } else if (key.scope.mode === 'prefix') {
                    const rn = rowIndex.nodes.get(pathKey(key.scope.rowPrefix)), cn = columnIndex.nodes.get(pathKey(key.scope.columnPrefix));
                    if (!rn || !cn) fail('domain-unavailable', 'Unknown prefix domain.');
                    row = rowIndex.leaves[rn.start]; column = columnIndex.leaves[cn.start];
                    if (!row || !column) fail('domain-unavailable', 'Prefix domain has no visible member paths.');
                }
                const expected = domainKeyFor(plan, key.fieldRef, key.channel, row, column);
                if (domainStorageKey(expected) !== domainStorageKey(key) || expected.familyId !== key.familyId) fail('domain-unavailable', 'Domain key does not match the effective display plan.');
                const storage = domainStorageKey(key);
                selected[storage] = domains[storage] ?? buildDomain(bindings.get(key.fieldRef)!, [], key);
            }
            return { version, domains: selected, series };
        },
        async readPaneData(request, signal) {
            begin(request.version, signal);
            if (request.cursor !== undefined) fail('source-contract-violation', 'Complete prepared sources do not issue pagination cursors.');
            if (request.windows.length > MAX_PANE_WINDOWS) fail('resource-limit', `Pane reads are limited to ${MAX_PANE_WINDOWS} windows.`);
            const panes = new Map<string, PaneData>();
            for (const window of request.windows) {
                checkRange(window.rows, rowIndex.leaves.length);
                checkRange(window.columns, columnIndex.leaves.length);
                for (let rowCursor = lowerBound(occupiedRows, window.rows.start); rowCursor < occupiedRows.length && occupiedRows[rowCursor] < window.rows.end; rowCursor++) {
                    checkAbort(signal);
                    const rowRank = occupiedRows[rowCursor];
                    const start = lowerBound(sortedColumns, window.columns.start, offsets[rowCursor], offsets[rowCursor + 1]);
                    const end = lowerBound(sortedColumns, window.columns.end, start, offsets[rowCursor + 1]);
                    for (let cursor = start; cursor < end;) {
                        const columnRank = sortedColumns[cursor];
                        const rowLeaf = rowIndex.leaves[rowRank];
                        const columnLeaf = columnIndex.leaves[columnRank];
                        const key = paneKey(rowLeaf.key, columnLeaf.key);
                        const values: PaneRecord[] = [];
                        do {
                            const index = sortedOrdinals[cursor++], seriesOrdinal = recordSeries[index];
                            values.push({ ...paneRecords[index], seriesKey: seriesKeyFor(key, seriesKeys[seriesOrdinal]), seriesOrdinal });
                        } while (cursor < end && sortedColumns[cursor] === columnRank);
                        if (!panes.has(key)) panes.set(key, { key, rowKey: rowLeaf.key, columnKey: columnLeaf.key, rowRank, columnRank,
                            rowSlotId: rowLeaf.slotId, columnSlotId: columnLeaf.slotId, rowPath: rowLeaf.path, columnPath: columnLeaf.path,
                            records: values, complete, seriesCount: seriesKeys.length });
                    }
                }
            }
            return { version, coveredWindows: complete ? request.windows.map((window) => ({ rows: { ...window.rows }, columns: { ...window.columns } })) : [],
                panes: [...panes.values()].sort((a, b) => a.rowRank - b.rowRank || a.columnRank - b.columnRank) };
        },
    };
    return Object.freeze(source);
}
