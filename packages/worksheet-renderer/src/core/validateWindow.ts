import { axisLeafKey, headerKey, paneKey, pathKey, sameVersion, toTypedValue, typedValueKey } from './keys';
import { PreparedDataError } from './prepared';
import type { Axis, AxisLeaf, AxisPlan, AxisWindow, DomainBatch, MemberPath, PaneBatch, PaneRecord, PaneWindow, RankRange, ReadVersion, RenderDataManifest, RenderPlan, ResultBinding, TypedValue } from './types';

export interface CompleteWindowInput {
    readonly plan: RenderPlan;
    readonly version: ReadVersion;
    readonly manifest: RenderDataManifest;
    readonly window: PaneWindow;
    readonly rows: AxisWindow;
    readonly columns: AxisWindow;
    readonly panes: PaneBatch;
    readonly domains: DomainBatch;
}

function reject(message: string, code = 'source-contract-violation', fieldRef?: string): never {
    throw new PreparedDataError(code, message, fieldRef);
}

function requireVersion(actual: ReadVersion, expected: ReadVersion, label: string): void {
    if (!actual || !sameVersion(actual, expected)) reject(`${label} returned a different ReadVersion.`, 'version-expired');
}

function requireRange(range: RankRange, total: number, label: string): void {
    if (!range || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start || range.end > total) {
        reject(`${label} has an invalid half-open rank range.`);
    }
}

function requireTypedValue(value: TypedValue): void {
    if (!value || !['null', 'number', 'string', 'boolean', 'time', 'interval'].includes(value.type)) reject('Member paths require tagged typed values.');
    if (value.type === 'null') return;
    if (value.type === 'interval') {
        const start = value.start as TypedValue;
        const end = value.end as TypedValue;
        if (!start || !end || start.type === 'interval' || end.type === 'interval') reject('Member interval endpoints must be scalar values.');
        requireTypedValue(start);
        requireTypedValue(end);
        return;
    }
    const type = value.type === 'time' ? 'number' : value.type;
    if (typeof value.value !== type || typeof value.value === 'number' && !Number.isFinite(value.value)) reject('Member paths contain an invalid typed value.');
    if (value.type === 'time' && Math.abs(value.value) > 8_640_000_000_000_000) reject('Member time values exceed the supported epoch range.');
}

function requirePath(path: MemberPath, fields: readonly string[]): void {
    if (!Array.isArray(path) || path.length !== fields.length) reject('Member path depth does not match its axis facets.');
    path.forEach((member, index) => {
        if (!member || member.fieldRef !== fields[index]) reject('Member path fields do not match the axis facet order.');
        requireTypedValue(member.value);
    });
}

function validateAxis(response: AxisWindow, axis: Axis, axisPlan: AxisPlan, range: RankRange, total: number, version: ReadVersion): ReadonlyMap<number, AxisLeaf> {
    requireVersion(response.version, version, `${axis} axis`);
    if (response.axis !== axis) reject(`The ${axis} response has the wrong axis identifier.`);
    requireRange(response.range, total, `${axis} response`);
    if (response.range.start !== range.start || response.range.end !== range.end) reject(`The ${axis} response range does not match the requested range.`);
    if (response.leaves.length !== range.end - range.start) reject(`The ${axis} response is missing requested leaf ranks.`, 'incomplete-data');
    const keys = new Set<string>();
    const byRank = new Map<number, AxisLeaf>();
    const slotByPosition = new Map<string | undefined, string>();
    response.leaves.forEach((leaf, index) => {
        if (leaf.rank !== range.start + index) reject(`The ${axis} leaves must contain every requested rank once, in rank order.`);
        if (typeof leaf.key !== 'string' || !leaf.key || keys.has(leaf.key)) reject(`The ${axis} leaf keys must be non-empty and unique.`);
        if (typeof leaf.slotId !== 'string' || !leaf.slotId) reject(`The ${axis} leaf is missing its slot identity.`);
        if (axisPlan.positions.length ? !axisPlan.positions.includes(leaf.positionRef ?? '') : leaf.positionRef !== undefined) reject(`The ${axis} leaf position does not belong to the render plan.`);
        const previousSlot = slotByPosition.get(leaf.positionRef);
        if (previousSlot !== undefined && previousSlot !== leaf.slotId) reject(`The ${axis} position uses inconsistent slot identities.`);
        slotByPosition.set(leaf.positionRef, leaf.slotId);
        requirePath(leaf.path, axisPlan.facets);
        if (leaf.key !== axisLeafKey(axis, leaf.path, leaf.slotId)) reject(`The ${axis} leaf key does not match its member path and slot.`);
        keys.add(leaf.key);
        byRank.set(leaf.rank, leaf);
    });
    const headers = new Map<string, (typeof response.ancestors)[number]>();
    for (const header of response.ancestors) {
        const slotHeader = header.depth === axisPlan.facets.length && axisPlan.positions.length > 1;
        if (!Number.isSafeInteger(header.depth) || header.depth < 0 || header.depth >= axisPlan.facets.length && !slotHeader) reject(`The ${axis} header has an invalid depth.`);
        requireRange({ start: header.start, end: header.end }, total, `${axis} header`);
        if (header.start === header.end || header.end <= range.start || header.start >= range.end) reject(`The ${axis} header must span at least one requested leaf.`);
        if (headers.has(header.key) || typeof header.label !== 'string') reject(`The ${axis} headers must have unique keys and string labels.`);
        requirePath(header.path, axisPlan.facets.slice(0, slotHeader ? header.depth : header.depth + 1));
        const parentPath = slotHeader ? header.path : header.path.slice(0, -1);
        const expectedParent = parentPath.length ? headerKey(axis, parentPath) : undefined;
        if (header.parentKey !== expectedParent) reject(`The ${axis} header parent does not match its member path.`);
        if (slotHeader) {
            const leaf = byRank.get(header.start);
            if (!leaf || header.end !== header.start + 1 || header.key !== JSON.stringify(['slot-header', leaf.key])) reject(`The ${axis} slot header does not match its leaf.`);
        } else if (header.key !== headerKey(axis, header.path)) reject(`The ${axis} header key does not match its member path.`);
        for (const leaf of response.leaves) {
            if (leaf.rank >= header.start && leaf.rank < header.end && pathKey(leaf.path.slice(0, header.path.length)) !== pathKey(header.path)) reject(`The ${axis} header span crosses unrelated member paths.`);
        }
        headers.set(header.key, header);
    }
    for (const leaf of response.leaves) {
        for (let depth = 1; depth <= axisPlan.facets.length; depth++) {
            const header = headers.get(headerKey(axis, leaf.path.slice(0, depth)));
            if (!header || leaf.rank < header.start || leaf.rank >= header.end) reject(`The ${axis} response is missing a visible leaf's ancestor span.`, 'incomplete-data');
        }
        if (axisPlan.positions.length > 1 && !headers.has(JSON.stringify(['slot-header', leaf.key]))) reject(`The ${axis} response is missing a measure-slot header.`, 'incomplete-data');
    }
    return byRank;
}

function requiredDomains(plan: RenderPlan): Set<string> {
    const fields = new Set([...plan.rows.positions, ...plan.columns.positions]);
    for (const name of ['color', 'size', 'opacity', 'shape'] as const) {
        const channel = plan.channels?.[name];
        if (channel && 'fieldRef' in channel) fields.add(channel.fieldRef);
    }
    return fields;
}

function validateDomains(input: CompleteWindowInput, bindings: ReadonlyMap<string, ResultBinding>): void {
    const { plan, domains } = input;
    requireVersion(domains.version, input.version, 'Domain batch');
    const required = requiredDomains(plan);
    for (const fieldRef of required) if (!domains.domains[fieldRef]) reject('A required field domain is missing.', 'domain-unavailable', fieldRef);
    const stackedFields = new Set<string>();
    if (plan.mark === 'bar' && plan.stack === 'zero') {
        for (const rowRef of plan.rows.positions.length ? plan.rows.positions : [undefined]) {
            for (const columnRef of plan.columns.positions.length ? plan.columns.positions : [undefined]) {
                const rowBinding = bindings.get(rowRef ?? '');
                const horizontal = plan.barOrientation === 'horizontal' || rowBinding?.positionType === 'band';
                const valueRef = horizontal ? columnRef : rowRef;
                if (valueRef) stackedFields.add(valueRef);
            }
        }
    }
    for (const [fieldRef, domain] of Object.entries(domains.domains)) {
        const binding = bindings.get(fieldRef);
        if (!binding || domain.fieldRef !== fieldRef || typeof domain.domainId !== 'string' || !domain.domainId) reject('Domain identity does not match a result binding.', 'source-contract-violation', fieldRef);
        if (domain.complete !== true || domain.source === 'unavailable') reject('The source did not provide a complete field domain.', 'domain-unavailable', fieldRef);
        if (domain.source !== 'prepared' && domain.source !== 'fixed' || typeof domain.empty !== 'boolean') reject('The domain has invalid completeness metadata.', 'source-contract-violation', fieldRef);
        const expectedType = binding.positionType ?? (binding.valueType === 'number' ? 'linear' : binding.valueType === 'time' ? 'time' : 'band');
        if (domain.type !== expectedType) reject('Domain type does not match the result binding.', 'source-contract-violation', fieldRef);
        if (domain.extentKind !== 'value' && domain.extentKind !== 'stacked') reject('The domain has an invalid extent kind.', 'source-contract-violation', fieldRef);
        if (stackedFields.has(fieldRef) && !domain.empty && input.panes.panes.some((pane) => pane.records.length > 0) && domain.source !== 'fixed' && domain.extentKind !== 'stacked') reject('The source did not provide stacked rendering endpoints.', 'domain-unavailable', fieldRef);
        if (!Array.isArray(domain.values)) reject('Domain values must be an array.', 'source-contract-violation', fieldRef);
        if (domain.type === 'band') {
            const values = new Set<string>();
            for (const value of domain.values) {
                let key: string;
                try { key = typedValueKey(toTypedValue(value, binding.valueType === 'time' ? 'time' : undefined)); }
                catch { reject('Band domain contains an invalid typed value.', 'source-contract-violation', fieldRef); }
                if (values.has(key!)) reject('Band domain values must be unique.', 'source-contract-violation', fieldRef);
                values.add(key!);
            }
        } else if (domain.values.length !== 2 || domain.values.some((value) => typeof value !== 'number' || !Number.isFinite(value)) || (domain.values[0] as number) > (domain.values[1] as number)) {
            reject('Continuous domains require two finite, ordered endpoints.', 'source-contract-violation', fieldRef);
        }
    }
    for (const leaf of [...input.rows.leaves, ...input.columns.leaves]) {
        const domain = leaf.positionRef ? domains.domains[leaf.positionRef] : undefined;
        if (domain?.type === 'band' && leaf.bandDomainId !== domain.domainId) reject('A band leaf does not identify its complete domain.', 'source-contract-violation', leaf.positionRef);
    }
}

function validateCoverage(input: CompleteWindowInput): void {
    const { window, panes, manifest } = input;
    for (const coverage of panes.coveredWindows) {
        requireRange(coverage.rows, manifest.rowLeafCount, 'Pane coverage rows');
        requireRange(coverage.columns, manifest.columnLeafCount, 'Pane coverage columns');
    }
    if (window.rows.start === window.rows.end || window.columns.start === window.columns.end) return;
    // A viewport bounds the requested rows. Union column intervals rather than allocating a grid.
    for (let row = window.rows.start; row < window.rows.end; row++) {
        const intervals = panes.coveredWindows.filter((coverage) => row >= coverage.rows.start && row < coverage.rows.end)
            .map((coverage) => coverage.columns).sort((a, b) => a.start - b.start);
        let through = window.columns.start;
        for (const interval of intervals) {
            if (interval.start > through) break;
            through = Math.max(through, interval.end);
            if (through >= window.columns.end) break;
        }
        if (through < window.columns.end) reject('The source has not established complete coverage of the requested pane window.', 'incomplete-data');
    }
}

function validateRecordValues(record: PaneRecord, row: AxisLeaf, column: AxisLeaf, plan: RenderPlan, bindings: ReadonlyMap<string, ResultBinding>): void {
    if (!record.values || typeof record.values !== 'object' || Array.isArray(record.values)) reject('Pane records require a prepared values object.');
    const required = new Set([...plan.rows.facets, ...plan.columns.facets, ...(plan.channels?.details ?? [])]);
    if (row.positionRef) required.add(row.positionRef);
    if (column.positionRef) required.add(column.positionRef);
    for (const name of ['color', 'size', 'opacity', 'shape', 'text'] as const) {
        const channel = plan.channels?.[name];
        if (channel && 'fieldRef' in channel) required.add(channel.fieldRef);
    }
    const typed = new Map<string, TypedValue>();
    for (const fieldRef of required) {
        const binding = bindings.get(fieldRef);
        if (!binding) reject('A pane uses a field without a result binding.', 'source-contract-violation', fieldRef);
        if (!Object.prototype.hasOwnProperty.call(record.values, binding.columnKey) || record.values[binding.columnKey] === undefined) reject('A pane record is missing a required prepared column.', 'missing-binding', fieldRef);
        if (binding.rawColumnKey !== undefined && (!Object.prototype.hasOwnProperty.call(record.values, binding.rawColumnKey) || record.values[binding.rawColumnKey] === undefined)) reject('A pane record is missing a declared raw-value column.', 'missing-binding', fieldRef);
        const value = record.values[binding.columnKey];
        const continuous = binding.positionType === 'linear' || binding.positionType === 'time' || !binding.positionType && (binding.valueType === 'number' || binding.valueType === 'time');
        if (value !== null && continuous && (typeof value !== 'number' || !Number.isFinite(value))) reject('A continuous pane value must be a finite prepared number or null.', 'invalid-value', fieldRef);
        try {
            const hint = binding.valueType === 'time' || binding.positionType === 'time' ? 'time' : binding.valueType === 'interval' ? 'interval' : undefined;
            typed.set(fieldRef, toTypedValue(value, hint));
        } catch {
            reject('A pane record contains an invalid prepared value.', 'invalid-value', fieldRef);
        }
    }
    for (const member of [...row.path, ...column.path]) {
        if (typedValueKey(typed.get(member.fieldRef)!) !== typedValueKey(member.value)) reject('A pane record facet value does not match its member path.', 'source-contract-violation', member.fieldRef);
    }
}

/** S0 commits only complete windows. Partial or mismatched responses cannot be painted or exported as complete. */
export function assertCompleteWindow(input: CompleteWindowInput): void {
    const { plan, version, manifest, window, rows, columns, panes } = input;
    requireVersion(manifest.version, version, 'Source manifest');
    if (manifest.status !== 'complete') reject('S0 requires a complete source manifest.', 'incomplete-data');
    if (manifest.domainPlanKey !== plan.domainPlanKey || !manifest.capabilities.domainPlanKeys.includes(plan.domainPlanKey)) reject('Source domain plan does not match the render plan.');
    for (const count of [manifest.rowLeafCount, manifest.columnLeafCount, manifest.recordCount, manifest.nonEmptyPaneCount]) if (!Number.isSafeInteger(count) || count < 0) reject('Source manifest counts must be non-negative safe integers.');
    requireRange(window.rows, manifest.rowLeafCount, 'Requested rows');
    requireRange(window.columns, manifest.columnLeafCount, 'Requested columns');
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const rowLeaves = validateAxis(rows, 'row', plan.rows, window.rows, manifest.rowLeafCount, version);
    const columnLeaves = validateAxis(columns, 'column', plan.columns, window.columns, manifest.columnLeafCount, version);
    requireVersion(panes.version, version, 'Pane batch');
    if (panes.nextCursor !== undefined) reject('S0 requires a complete pane batch without a continuation cursor.', 'incomplete-data');
    const paneKeys = new Set<string>();
    const paneRanks = new Set<string>();
    for (const pane of panes.panes) {
        if (pane.complete !== true) reject('S0 cannot commit a partially loaded pane.', 'incomplete-data');
        const row = rowLeaves.get(pane.rowRank);
        const column = columnLeaves.get(pane.columnRank);
        if (!row || !column) reject('A pane rank is outside the requested axis window.');
        if (pane.rowKey !== row.key || pane.columnKey !== column.key || pane.rowSlotId !== row.slotId || pane.columnSlotId !== column.slotId) reject('Pane keys or slots do not match the returned axis ranks.');
        if (pathKey(pane.rowPath) !== pathKey(row.path) || pathKey(pane.columnPath) !== pathKey(column.path)) reject('Pane member paths do not match the returned axis ranks.');
        if (pane.key !== paneKey(row.key, column.key)) reject('Pane key does not match its canonical row and column identity.');
        const rankKey = JSON.stringify([pane.rowRank, pane.columnRank]);
        if (paneKeys.has(pane.key) || paneRanks.has(rankKey)) reject('The pane batch contains a duplicate pane identity or rank pair.');
        paneKeys.add(pane.key);
        paneRanks.add(rankKey);
        const datumKeys = new Set<string>();
        for (const record of pane.records) {
            if (typeof record.datumKey !== 'string' || !record.datumKey || datumKeys.has(record.datumKey)) reject('Each pane must contain unique, non-empty datum keys.');
            if (!Number.isSafeInteger(record.ordinal) || record.ordinal < 0) reject('Pane records require stable non-negative integer ordinals.');
            validateRecordValues(record, row, column, plan, bindings);
            datumKeys.add(record.datumKey);
        }
    }
    validateCoverage(input);
    validateDomains(input, bindings);
}
