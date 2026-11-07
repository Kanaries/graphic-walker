import { axisLeafKey, decodeAxisLeafKey, headerKey, paneKey, sameVersion, toTypedValue } from '../src/core/keys';
import { seriesIdentityFor, seriesKeyFor } from '../src/core/series';
import type { Axis, AxisLeaf, HeaderSpan, RenderDataSource, RenderPlan, ReadVersion, RankRange, PreparedRecord, PaneData } from '../src/core/types';

/** B4 is generated on demand and is intentionally separate from B3's million stored records. */
export function createB4Source(plan: RenderPlan, options: { rowCount?: number; columnCount?: number } = {}): RenderDataSource {
    const rowCount = options.rowCount ?? 1_000_000_000, columnCount = options.columnCount ?? 1_000_000;
    if (!Number.isSafeInteger(rowCount * columnCount)) throw new Error('B4 logical slot count must be a safe integer');
    if (plan.rows.facets.length !== 6 || plan.columns.facets.length !== 6) throw new Error('B4 needs six facet fields per axis');
    const version: ReadVersion = { sourceId: 'B4-programmatic', snapshotId: '1', presentationId: '1' };
    const factors = [100_000, 10_000, 1000, 100, 10, 1];
    const count = (axis: Axis) => axis === 'row' ? rowCount : columnCount;
    const fields = (axis: Axis) => axis === 'row' ? plan.rows : plan.columns;
    const check = (requested: ReadVersion, signal: AbortSignal) => { signal.throwIfAborted(); if (!sameVersion(requested, version)) throw new Error('version-expired'); };
    const range = (value: RankRange, total: number) => { if (!Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end) || value.start < 0 || value.end < value.start || value.end > total) throw new Error('source-contract-violation: B4 rank range'); };
    const leaf = (axis: Axis, rank: number): AxisLeaf => {
        const selected = fields(axis), prefix = axis === 'row' ? 'r' : 'c';
        const path = selected.facets.map((fieldRef, depth) => ({ fieldRef, value: toTypedValue(`${prefix}${depth}:${Math.floor(rank / factors[depth])}`) }));
        const positionRef = selected.positions[0], slotId = JSON.stringify(['slot', axis, positionRef]);
        return { key: axisLeafKey(axis, path, slotId), rank, path, slotId, positionRef };
    };
    const valuesAt = (row: AxisLeaf, column: AxisLeaf): PreparedRecord => {
        const values: Record<string, unknown> = { id: `B4:${row.rank}:${column.rank}`, x: (row.rank % 101) - 50, y: (column.rank % 101) - 50 };
        for (const member of [...row.path, ...column.path]) values[plan.bindings.find((binding) => binding.fieldRef === member.fieldRef)!.columnKey] = member.value.type === 'null' ? null : 'value' in member.value ? member.value.value : undefined;
        return values;
    };
    const identity = seriesIdentityFor(plan, valuesAt(leaf('row', 0), leaf('column', 0)));
    return {
        version,
        async describe(signal) {
            signal.throwIfAborted();
            return { version, domainPlanKey: plan.domainPlanKey, rowLeafCount: rowCount, columnLeafCount: columnCount, recordCount: rowCount * columnCount, nonEmptyPaneCount: rowCount * columnCount, status: 'complete', identityScope: 'stable', capabilities: { randomAxisAccess: true, locateByKey: true, maxAxisWindow: 1000, maxPaneWindows: 4, domainPlanKeys: [plan.domainPlanKey] } };
        },
        async readAxis(request, signal) {
            check(request.version, signal); range(request.range, count(request.axis));
            if (request.range.end - request.range.start > 1000) throw new Error('resource-limit: B4 axis window');
            const leaves: AxisLeaf[] = [], headers = new Map<string, HeaderSpan>();
            for (let rank = request.range.start; rank < request.range.end; rank++) {
                const item = leaf(request.axis, rank); leaves.push(item);
                for (let depth = 0; depth < 6; depth++) {
                    const path = item.path.slice(0, depth + 1), key = headerKey(request.axis, path), start = Math.floor(rank / factors[depth]) * factors[depth];
                    const member = path[depth].value;
                    headers.set(key, { key, path, depth, start, end: Math.min(count(request.axis), start + factors[depth]), label: member.type === 'string' ? member.value : '', kind: 'member', expanded: true, ...(depth ? { parentKey: headerKey(request.axis, path.slice(0, -1)) } : {}) });
                }
            }
            return { version, axis: request.axis, range: request.range, leaves, ancestors: [...headers.values()] };
        },
        async readPaneData(request, signal) {
            check(request.version, signal);
            const panes: PaneData[] = [], seen = new Set<string>();
            for (const window of request.windows) {
                range(window.rows, rowCount); range(window.columns, columnCount);
                if ((window.rows.end - window.rows.start) * (window.columns.end - window.columns.start) > 200) throw new Error('resource-limit: B4 pane window');
                for (let r = window.rows.start; r < window.rows.end; r++) for (let c = window.columns.start; c < window.columns.end; c++) {
                    const row = leaf('row', r), column = leaf('column', c), key = paneKey(row.key, column.key);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const values = valuesAt(row, column);
                    panes.push({ key, rowKey: row.key, columnKey: column.key, rowRank: r, columnRank: c, rowSlotId: row.slotId, columnSlotId: column.slotId, rowPath: row.path, columnPath: column.path, complete: true, seriesCount: 1,
                        records: [{ datumKey: String(values.id), ordinal: r * columnCount + c, values, seriesKey: seriesKeyFor(key, identity), seriesOrdinal: 0 }] });
                }
            }
            return { version, coveredWindows: request.windows, panes };
        },
        async readDomains(request, signal) {
            check(request.version, signal);
            return { version, series: { domainId: `B4-series:${plan.domainPlanKey}`, keys: [identity], complete: true }, domains: Object.fromEntries(request.fieldRefs.map((fieldRef) => {
                const binding = plan.bindings.find((candidate) => candidate.fieldRef === fieldRef);
                if (!binding || binding.valueType !== 'number') throw new Error('B4 only supplies its numeric position domains');
                return [fieldRef, { fieldRef, domainId: `B4-domain:${fieldRef}`, type: 'linear' as const, values: [-100, 100], complete: true, extentKind: 'value' as const, empty: false, source: 'fixed' as const }];
            })) };
        },
        async locate(request, signal) {
            check(request.version, signal);
            const decoded = decodeAxisLeafKey(request.key), value = decoded?.path.at(-1)?.value;
            const rank = value?.type === 'string' ? Number(value.value.split(':').at(-1)) : NaN;
            if (decoded?.axis === request.axis && Number.isSafeInteger(rank) && rank >= 0 && rank < count(request.axis)) {
                const item = leaf(request.axis, rank);
                if (item.key === request.key) return { version, status: 'found', rank, leaf: item };
            }
            return { version, status: 'missing' };
        },
    };
}
