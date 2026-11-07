import {
    bindingTypedValue,
    pathKey,
    typedValueKey,
    type Axis,
    type ControlledRequest,
    type Diagnostic,
    type DisplayDomain,
    type MemberOrder,
    type MemberPath,
    type PreparedDataSourceOptions,
    type PreparedRecord,
    type RenderDataSource,
    type RenderPlan,
    type TypedValue,
} from '@kanaries/worksheet-renderer';
import type { NativeFieldReference } from './adapter';

export interface NativeDisplayState {
    readonly collapsed: readonly { axis: Axis; path: MemberPath }[];
    readonly sorts: readonly { axis: Axis; parent: MemberPath; fieldRef: string; direction: 'ascending' | 'descending' }[];
    readonly revision: number;
}
export const emptyNativeDisplayState: NativeDisplayState = Object.freeze({ collapsed: [], sorts: [], revision: 0 });

/** Match the ordinary GW/Vega categorical default without recomputing a statistic. */
export function orderNativeDomains(source: RenderDataSource, plan: RenderPlan): RenderDataSource {
    const cache = new WeakMap<DisplayDomain, DisplayDomain>(),
        bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    return {
        ...source,
        async readDomains(request, signal) {
            const batch = await source.readDomains(request, signal);
            return {
                ...batch,
                domains: Object.fromEntries(
                    Object.entries(batch.domains).map(([key, domain]) => {
                        if (domain.type !== 'band' || plan.scales?.[domain.fieldRef]?.domain) return [key, domain];
                        let ordered = cache.get(domain);
                        if (!ordered) {
                            const binding = bindings.get(domain.fieldRef)!;
                            const typed = (value: unknown): TypedValue =>
                                value && typeof value === 'object' && 'type' in value ? (value as TypedValue) : bindingTypedValue(binding, value);
                            const values = [...domain.values].sort((a, b) => compareNativeMembers(typed(a), typed(b)));
                            ordered = { ...domain, values };
                            cache.set(domain, ordered);
                        }
                        return [key, ordered];
                    }),
                ),
            };
        },
    };
}
const samePath = (a: MemberPath, b: MemberPath) => pathKey(a) === pathKey(b);
const prefix = (a: MemberPath, b: MemberPath) =>
    a.length <= b.length && a.every((part, index) => part.fieldRef === b[index].fieldRef && typedValueKey(part.value) === typedValueKey(b[index].value));
/** Total typed comparison: null precedes other types; numbers/time retain numeric order. */
export function compareNativeMembers(a: TypedValue, b: TypedValue): number {
    if (a.type !== b.type) return a.type === 'null' ? -1 : b.type === 'null' ? 1 : a.type < b.type ? -1 : 1;
    if (a.type === 'null' || b.type === 'null') return 0;
    if (a.type === 'interval' && b.type === 'interval') return compareNativeMembers(a.start, b.start) || compareNativeMembers(a.end, b.end);
    if (a.type === 'interval' || b.type === 'interval') return 0;
    return a.value === b.value ? 0 : a.value < b.value ? -1 : 1;
}
export function updateNativeDisplay(
    state: NativeDisplayState,
    request: ControlledRequest,
    plan: RenderPlan,
    disableCollapse = false,
): { state?: NativeDisplayState; reason?: string } {
    const { axis, path, fieldRef } = request.target,
        facets = plan[axis === 'row' ? 'rows' : 'columns'].facets;
    if (
        !path.length ||
        path.length > facets.length ||
        path.some((member, depth) => member.fieldRef !== facets[depth]) ||
        path[path.length - 1].fieldRef !== fieldRef
    )
        return { reason: 'The requested header is not a facet member in this prepared display.' };
    if (request.kind === 'collapse') {
        if (disableCollapse) return { reason: 'Collapsing is disabled by the host.' };
        if (!('expanded' in request.intent) || path.length >= facets.length) return { reason: 'Only a parent member can change its expanded state.' };
        const collapsed = state.collapsed.filter((item) => !(item.axis === axis && samePath(item.path, path)));
        if (!request.intent.expanded) collapsed.push({ axis, path });
        return { state: { ...state, collapsed, revision: state.revision + 1 } };
    }
    if (!('direction' in request.intent)) return { reason: 'The sort direction is missing.' };
    const parent = path.slice(0, -1),
        sorts = state.sorts.filter((item) => !(item.axis === axis && item.fieldRef === fieldRef && samePath(item.parent, parent)));
    sorts.push({ axis, parent, fieldRef, direction: request.intent.direction });
    return { state: { ...state, sorts, revision: state.revision + 1 } };
}

export function prepareNativeDisplay(
    plan: RenderPlan,
    records: readonly PreparedRecord[],
    state: NativeDisplayState,
    fields: ReadonlyMap<string, NativeFieldReference>,
) {
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const diagnostics: Diagnostic[] = [],
        memberOrder: MemberOrder[] = [];
    for (const ref of [...plan.rows.facets, ...plan.columns.facets]) {
        const original = fields.get(ref);
        if (original?.field.sort && original.field.sort !== 'none')
            diagnostics.push({
                code: 'unsupported-sort',
                fieldRef: ref,
                configRef: original.configRef,
                severity: 'error',
                recoverable: true,
                message:
                    'Measure-driven facet sorting requires a supplied parent sort metric. Header sorting can reorder typed member values without calculating metrics.',
            });
    }
    const axisMembers: NonNullable<PreparedDataSourceOptions['axisMembers']> = {};
    const pathsFor = new Map<Axis, (record: PreparedRecord) => MemberPath>();
    for (const axis of ['row', 'column'] as const) {
        const facets = plan[axis === 'row' ? 'rows' : 'columns'].facets;
        const paths = new Map<string, MemberPath>(),
            siblings = new Map<string, { parent: MemberPath; fieldRef: string; values: Map<string, TypedValue> }>();
        type Node = { path: MemberPath; children: Map<string, Node>; terminal: boolean };
        const root: Node = { path: [], children: new Map(), terminal: false };
        const valueCaches = facets.map(() => new Map<unknown, { value: TypedValue; key: string }>());
        const member = (record: PreparedRecord, depth: number) => {
            const binding = bindings.get(facets[depth])!,
                raw = record[binding.columnKey];
            let item = valueCaches[depth].get(raw);
            if (!item) {
                const value = bindingTypedValue(binding, raw);
                item = { value, key: typedValueKey(value) };
                valueCaches[depth].set(raw, item);
            }
            return item;
        };
        pathsFor.set(axis, (record) =>
            facets.map((fieldRef) => {
                const binding = bindings.get(fieldRef)!;
                return { fieldRef, value: bindingTypedValue(binding, record[binding.columnKey]) };
            }),
        );
        for (const record of records) {
            let node = root;
            for (let depth = 0; depth < facets.length; depth++) {
                const fieldRef = facets[depth],
                    item = member(record, depth);
                let child = node.children.get(item.key);
                if (!child) {
                    const key = pathKey(node.path);
                    let group = siblings.get(key);
                    if (!group) {
                        group = { parent: node.path, fieldRef, values: new Map() };
                        siblings.set(key, group);
                    }
                    group.values.set(item.key, item.value);
                    child = { path: [...node.path, { fieldRef, value: item.value }], children: new Map(), terminal: false };
                    node.children.set(item.key, child);
                }
                node = child;
            }
            if (!node.terminal) {
                node.terminal = true;
                paths.set(pathKey(node.path), node.path);
            }
        }
        const visible = new Map<string, { path: MemberPath; collapsed?: boolean }>();
        for (const path of paths.values()) {
            const collapsed = state.collapsed.filter((item) => item.axis === axis && prefix(item.path, path)).sort((a, b) => a.path.length - b.path.length)[0];
            const shown = collapsed ? { path: collapsed.path, collapsed: true } : { path };
            visible.set(pathKey(shown.path), shown);
        }
        if (state.collapsed.some((item) => item.axis === axis)) (axisMembers as Record<Axis, unknown>)[axis] = [...visible.values()];
        for (const group of siblings.values()) {
            const request = state.sorts.find((item) => item.axis === axis && item.fieldRef === group.fieldRef && samePath(item.parent, group.parent));
            const values = [...group.values.values()].sort(compareNativeMembers);
            if (request?.direction === 'descending') values.reverse();
            memberOrder.push({ axis, parent: group.parent, fieldRef: group.fieldRef, values });
        }
    }
    // The host preserves the actual full grain: hidden children cannot become parent values.
    const getRecordPath = state.collapsed.length ? (record: PreparedRecord, _index: number, axis: Axis): MemberPath => pathsFor.get(axis)!(record) : undefined;
    for (const collapsed of state.collapsed)
        diagnostics.push({
            code: 'empty-parent-display',
            severity: 'info',
            recoverable: true,
            fieldRef: collapsed.path[collapsed.path.length - 1]?.fieldRef,
            message: 'This prepared result contains child records only. Collapsed parent cells remain empty; no values are combined.',
        });
    const scales = { ...plan.scales };
    for (const axis of ['rows', 'columns'] as const)
        for (const ref of plan[axis].positions) {
            const binding = bindings.get(ref)!,
                original = fields.get(ref)?.field,
                sort = original?.sort;
            if (!sort || sort === 'none') continue;
            if (scales[ref]?.domain) {
                diagnostics.push({
                    code: 'unsupported-sort',
                    fieldRef: ref,
                    configRef: fields.get(ref)?.configRef,
                    severity: 'error',
                    recoverable: true,
                    message: 'A fixed member domain and measure-driven sorting specify two orders. Supply one prepared member order.',
                });
                continue;
            }
            if (binding.positionType !== 'band') {
                diagnostics.push({
                    code: 'unsupported-sort',
                    fieldRef: ref,
                    configRef: fields.get(ref)?.configRef,
                    severity: 'error',
                    recoverable: true,
                    message: 'Measure-driven sorting requires a categorical position with one supplied comparison value per member.',
                });
                continue;
            }
            const opposite = plan[axis === 'rows' ? 'columns' : 'rows'].positions;
            const measure = opposite.length === 1 ? bindings.get(opposite[0]) : undefined;
            const weights = new Map<string, { member: unknown; value: number | null }>();
            let ambiguous = !measure || measure.positionType !== 'linear';
            for (const record of records) {
                const key = typedValueKey(bindingTypedValue(binding, record[binding.columnKey])),
                    value = measure ? record[measure.columnKey] : null,
                    previous = weights.get(key);
                if ((value !== null && typeof value !== 'number') || (previous && previous.value !== value)) ambiguous = true;
                weights.set(key, { member: record[binding.columnKey], value: typeof value === 'number' ? value : null });
            }
            if (ambiguous)
                diagnostics.push({
                    code: 'unsupported-sort',
                    fieldRef: ref,
                    configRef: fields.get(ref)?.configRef,
                    severity: 'error',
                    recoverable: true,
                    message: 'Sorting these members needs a prepared sort metric. Native display preparation does not aggregate multiple comparison values.',
                });
            else
                scales[ref] = {
                    ...scales[ref],
                    domain: [...weights.values()]
                        .sort((a, b) => {
                            const order =
                                a.value === b.value
                                    ? compareNativeMembers(bindingTypedValue(binding, a.member), bindingTypedValue(binding, b.member))
                                    : a.value === null
                                      ? -1
                                      : b.value === null
                                        ? 1
                                        : a.value - b.value;
                            return sort === 'descending' ? -order : order;
                        })
                        .map((item) => item.member) as string[],
                };
        }
    return { plan: { ...plan, scales }, memberOrder, axisMembers, getRecordPath, diagnostics };
}
