import { axisLeafKey, headerKey, paneKey, pathKey, sameVersion, toTypedValue, typedValueKey, typedValueLabel } from './keys';
import type {
    Axis, AxisLeaf, AxisPlan, Diagnostic, DisplayDomain, HeaderSpan, MemberPath, PaneData, PaneRecord,
    PreparedDataSourceOptions, PreparedRecord, RankRange, ReadVersion, RenderDataSource, ResultBinding, TypedValue,
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
    const key = position === undefined ? '["default-position"]' : typedValueKey(toTypedValue(position));
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
    return Object.freeze(path.map((member) => Object.freeze({ fieldRef: member.fieldRef, value: Object.freeze(member.value) })));
}

interface Node {
    path: MemberPath;
    children: Map<string, Node>;
    start: number;
    end: number;
}
interface AxisIndex {
    leaves: readonly AxisLeaf[];
    byKey: ReadonlyMap<string, AxisLeaf>;
    headers: readonly (readonly HeaderSpan[])[];
    recordBases: Uint32Array;
    slotCount: number;
}

function valueFor(record: PreparedRecord, binding: ResultBinding): unknown {
    if (!Object.prototype.hasOwnProperty.call(record, binding.columnKey) || record[binding.columnKey] === undefined) {
        fail('missing-binding', `Prepared record is missing column ${JSON.stringify(binding.columnKey)}.`, binding.fieldRef);
    }
    return record[binding.columnKey];
}

function typedFor(record: PreparedRecord, binding: ResultBinding): TypedValue {
    try {
        return toTypedValue(valueFor(record, binding), binding.valueType === 'time' || binding.valueType === 'interval' ? binding.valueType : undefined);
    } catch (error) {
        if (error instanceof PreparedDataError) throw error;
        return fail('invalid-value', error instanceof Error ? error.message : 'Invalid prepared value.', binding.fieldRef);
    }
}

function createAxisIndex(axis: Axis, axisPlan: AxisPlan, records: readonly PreparedRecord[], bindings: ReadonlyMap<string, ResultBinding>, options: PreparedDataSourceOptions): AxisIndex {
    const root: Node = { path: Object.freeze([]), children: new Map(), start: 0, end: 0 };
    const recordNodes: Node[] = [];
    for (const record of records) {
        let node = root;
        for (const fieldRef of axisPlan.facets) {
            const value = typedFor(record, bindings.get(fieldRef)!);
            const key = typedValueKey(value);
            let child = node.children.get(key);
            if (!child) {
                child = { path: frozenPath([...node.path, { fieldRef, value }]), children: new Map(), start: 0, end: 0 };
                node.children.set(key, child);
            }
            node = child;
        }
        recordNodes.push(node);
    }
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
    const headers: HeaderSpan[][] = Array.from({ length: axisPlan.facets.length + (axisPlan.positions.length > 1 ? 1 : 0) }, () => []);
    const positions: readonly (string | undefined)[] = axisPlan.positions.length ? axisPlan.positions : [undefined];
    const append = (node: Node): void => {
        node.start = leaves.length;
        if (node.path.length === axisPlan.facets.length) {
            for (const positionRef of positions) {
                const slotId = JSON.stringify(['slot', axis, positionRef ?? null]);
                const leaf = Object.freeze({ key: axisLeafKey(axis, node.path, slotId), rank: leaves.length, path: node.path, slotId, positionRef,
                    bandDomainId: positionRef && (bindings.get(positionRef)!.positionType ?? 'band') === 'band' ? JSON.stringify(['domain', options.version, positionRef]) : undefined });
                leaves.push(leaf);
                if (axisPlan.positions.length > 1) {
                    headers[node.path.length].push(Object.freeze({ key: JSON.stringify(['slot-header', leaf.key]),
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
        if (node.path.length) {
            headers[node.path.length - 1].push(Object.freeze({ key: headerKey(axis, node.path),
                parentKey: node.path.length > 1 ? headerKey(axis, node.path.slice(0, -1)) : undefined,
                path: node.path, depth: node.path.length - 1, start: node.start, end: node.end,
                label: typedValueLabel(node.path[node.path.length - 1].value) }));
        }
    };
    append(root);
    if (leaves.length > MAX_UINT32) fail('resource-limit', 'The prepared axis exceeds the 32-bit rank index.');
    const recordBases = Uint32Array.from(recordNodes, (node) => node.start);
    return { leaves: Object.freeze(leaves), byKey: new Map(leaves.map((leaf) => [leaf.key, leaf])),
        headers: Object.freeze(headers.map((level) => Object.freeze(level))), recordBases, slotCount: positions.length };
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
 * S0 complete-input adapter: index prepared records, actual member paths and shared domains.
 * It performs no aggregation, filtering, expression evaluation, or data preparation.
 */
export function createPreparedDataSource(options: PreparedDataSourceOptions): RenderDataSource {
    const { plan } = options;
    const domainPlanKey = plan.domainPlanKey;
    const version: ReadVersion = Object.freeze({ ...options.version });
    for (const value of Object.values(version)) if (typeof value !== 'string' || !value) fail('source-contract-violation', 'Every ReadVersion identifier must be a non-empty string.');
    if (typeof domainPlanKey !== 'string' || !domainPlanKey) fail('source-contract-violation', 'The domain plan key must be a non-empty string.');
    if (plan.mark !== 'bar' && plan.mark !== 'point') fail('unsupported-encoding', `S0 prepared sources do not yet support ${plan.mark} marks.`);
    if (Object.values(plan.scales ?? {}).some((scale) => scale.scope && scale.scope.mode !== 'shared')) fail('unsupported-encoding', 'S0 prepared sources provide shared domains only.');
    if (options.identityScope === 'stable' && !options.getDatumKey) fail('unstable-datum-identity', 'Stable identity requires a host-provided datum key.');
    if (options.records.length > MAX_UINT32) fail('resource-limit', 'The prepared input exceeds the 32-bit record index.');
    const bindings = new Map<string, ResultBinding>();
    for (const binding of plan.bindings) {
        if (!binding.fieldRef || bindings.has(binding.fieldRef)) fail('source-contract-violation', 'Binding fieldRef values must be non-empty and unique.', binding.fieldRef);
        if (binding.valueType === 'interval') fail('unsupported-encoding', 'S0 prepared sources do not yet support interval columns.', binding.fieldRef);
        bindings.set(binding.fieldRef, binding);
    }
    const references = [...plan.rows.facets, ...plan.rows.positions, ...plan.columns.facets, ...plan.columns.positions, ...(plan.channels?.details ?? [])];
    for (const channel of Object.values(plan.channels ?? {})) if (channel && !Array.isArray(channel) && 'fieldRef' in channel) references.push(channel.fieldRef);
    for (const fieldRef of references) if (!bindings.has(fieldRef)) fail('missing-binding', 'The render plan references a missing result binding.', fieldRef);
    for (const axis of [plan.rows, plan.columns]) {
        if (new Set(axis.facets).size !== axis.facets.length || new Set(axis.positions).size !== axis.positions.length) fail('source-contract-violation', 'Repeated field occurrences require distinct fieldRef values.');
    }
    const entryCount = options.records.length * Math.max(1, plan.rows.positions.length) * Math.max(1, plan.columns.positions.length);
    if (!Number.isSafeInteger(entryCount) || entryCount > MAX_INDEX_ENTRIES) fail('resource-limit', `Prepared inputs are limited to ${MAX_INDEX_ENTRIES} record-to-slot index entries.`);
    const records: PreparedRecord[] = options.records.map((record) => Object.freeze({ ...record }));
    const keys = new Set<string>();
    const paneRecords: readonly PaneRecord[] = Object.freeze(records.map((record, ordinal) => {
        const datumKey = options.getDatumKey ? options.getDatumKey(options.records[ordinal], ordinal) : JSON.stringify(['datum', version.sourceId, version.snapshotId, ordinal]);
        if (typeof datumKey !== 'string' || !datumKey) fail('unstable-datum-identity', 'Datum keys must be non-empty strings.');
        if (keys.has(datumKey)) fail('unstable-datum-identity', 'Prepared records must have unique datum keys.');
        keys.add(datumKey);
        return Object.freeze({ datumKey, ordinal, values: record });
    }));
    const rowIndex = createAxisIndex('row', plan.rows, records, bindings, options);
    const columnIndex = createAxisIndex('column', plan.columns, records, bindings, options);
    const rows = new Uint32Array(entryCount);
    const columns = new Uint32Array(entryCount);
    const ordinals = new Uint32Array(entryCount);
    let entry = 0;
    for (let ordinal = 0; ordinal < records.length; ordinal++) {
        for (let rowSlot = 0; rowSlot < rowIndex.slotCount; rowSlot++) {
            for (let columnSlot = 0; columnSlot < columnIndex.slotCount; columnSlot++) {
                rows[entry] = rowIndex.recordBases[ordinal] + rowSlot;
                columns[entry] = columnIndex.recordBases[ordinal] + columnSlot;
                ordinals[entry++] = ordinal;
            }
        }
    }
    const sorted = Uint32Array.from({ length: entryCount }, (_, index) => index);
    sorted.sort((a, b) => rows[a] - rows[b] || columns[a] - columns[b] || ordinals[a] - ordinals[b]);
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
    const stackedFields = new Set<string>();
    if (plan.mark === 'bar' && plan.stack === 'zero') {
        for (const rowRef of plan.rows.positions.length ? plan.rows.positions : [undefined]) {
            for (const columnRef of plan.columns.positions.length ? plan.columns.positions : [undefined]) {
                const xBinding = bindings.get(columnRef ?? '');
                const yBinding = bindings.get(rowRef ?? '');
                const horizontal = plan.barOrientation === 'horizontal' || yBinding?.positionType === 'band';
                const valueBinding = horizontal ? xBinding : yBinding;
                if (valueBinding) stackedFields.add(valueBinding.fieldRef);
            }
        }
        let previousRow = -1;
        let previousColumn = -1;
        let stacks: BarStackState = new Map();
        for (let index = 0; index < sorted.length; index++) {
            const from = sorted[index];
            const rowRank = rows[from];
            const columnRank = columns[from];
            if (rowRank !== previousRow || columnRank !== previousColumn) stacks = new Map();
            previousRow = rowRank;
            previousColumn = columnRank;
            const xBinding = bindings.get(columnIndex.leaves[columnRank].positionRef ?? '');
            const yBinding = bindings.get(rowIndex.leaves[rowRank].positionRef ?? '');
            const horizontal = plan.barOrientation === 'horizontal' || yBinding?.positionType === 'band';
            const valueBinding = horizontal ? xBinding : yBinding;
            const positionBinding = horizontal ? yBinding : xBinding;
            if (!valueBinding) continue;
            const record = records[ordinals[from]];
            const value = valueFor(record, valueBinding);
            const position = positionBinding ? valueFor(record, positionBinding) : undefined;
            if (value === null || position === null && positionBinding?.positionType !== 'band') continue;
            if (typeof value !== 'number' || !Number.isFinite(value)) fail('invalid-value', 'Bar values must be finite prepared numbers or null.', valueBinding.fieldRef);
            const { start, end } = advanceBarStack(stacks, position, value);
            const extent = stackedExtents.get(valueBinding.fieldRef) ?? { minimum: 0, maximum: 0 };
            extent.minimum = Math.min(extent.minimum, start, end);
            extent.maximum = Math.max(extent.maximum, start, end);
            stackedExtents.set(valueBinding.fieldRef, extent);
        }
    }
    const domains: Record<string, DisplayDomain> = Object.create(null);
    for (const binding of plan.bindings) {
        const type = binding.positionType ?? (binding.valueType === 'number' ? 'linear' : binding.valueType === 'time' ? 'time' : 'band');
        const values: unknown[] = [];
        const seen = new Set<string>();
        let minimum = Infinity;
        let maximum = -Infinity;
        for (const record of records) {
            const value = valueFor(record, binding);
            if (type === 'band') {
                const key = typedValueKey(typedFor(record, binding));
                if (!seen.has(key)) { seen.add(key); values.push(value); }
            } else if (value !== null) {
                if (typeof value !== 'number' || !Number.isFinite(value)) fail('invalid-value', 'Continuous coordinates must be finite prepared numbers or null.', binding.fieldRef);
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
            }
        }
        const stacked = stackedExtents.get(binding.fieldRef);
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
                const key = typedValueKey(toTypedValue(value, binding.valueType === 'time' ? 'time' : undefined));
                if (unique.has(key)) fail('invalid-domain', 'A band domain must contain unique typed values.', binding.fieldRef);
                unique.add(key);
            }
        }
        domains[binding.fieldRef] = Object.freeze({ fieldRef: binding.fieldRef,
            domainId: JSON.stringify(['domain', version, binding.fieldRef]), type, values: Object.freeze(domain),
            complete: complete || !!scale?.domain, extentKind: stackedFields.has(binding.fieldRef) ? 'stacked' : 'value', empty, source: scale?.domain ? 'fixed' : 'prepared' });
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
            if (!leaf) return { version, status: 'missing' };
            if (request.path && pathKey(request.path) !== pathKey(leaf.path)) fail('source-contract-violation', 'The requested leaf key and path disagree.');
            return { version, status: 'found', rank: leaf.rank, leaf };
        },
        async readDomains(request, signal) {
            begin(request.version, signal);
            for (const key of request.keys ?? []) {
                if (key.scope.mode !== 'shared') fail('unsupported-encoding', 'S0 prepared sources provide shared domains only.');
                if (key.domainPlanKey !== domainPlanKey) fail('domain-unavailable', 'The requested domain plan is not available from this source.');
            }
            const selected: Record<string, DisplayDomain> = Object.create(null);
            for (const fieldRef of request.fieldRefs) {
                if (!domains[fieldRef]) fail('domain-unavailable', 'The requested field domain does not exist.', fieldRef);
                selected[fieldRef] = domains[fieldRef];
            }
            return { version, domains: selected };
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
                        do { values.push(paneRecords[sortedOrdinals[cursor++]]); } while (cursor < end && sortedColumns[cursor] === columnRank);
                        if (!panes.has(key)) panes.set(key, { key, rowKey: rowLeaf.key, columnKey: columnLeaf.key, rowRank, columnRank,
                            rowSlotId: rowLeaf.slotId, columnSlotId: columnLeaf.slotId, rowPath: rowLeaf.path, columnPath: columnLeaf.path,
                            records: values, complete });
                    }
                }
            }
            return { version, coveredWindows: complete ? request.windows.map((window) => ({ rows: { ...window.rows }, columns: { ...window.columns } })) : [],
                panes: [...panes.values()].sort((a, b) => a.rowRank - b.rowRank || a.columnRank - b.columnRank) };
        },
    };
    return Object.freeze(source);
}
