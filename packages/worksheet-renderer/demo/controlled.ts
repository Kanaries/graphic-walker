import { createPreparedDataSource, headerKey, pathKey, toTypedValue } from '../src';
import type { Axis, ControlledRequest, HeaderRequestTarget, MemberOrder, MemberPath, PreparedRecord, RenderPlan, WorksheetInput } from '../src';

const rowMembers = [
    { name: 'West', children: ['Seattle', 'Portland'] },
    { name: 'East', children: ['Boston', 'Atlanta'] },
];
const columnMembers = [
    { name: '2026', children: ['Q2', 'Q1'] },
    { name: '2025', children: ['Q2', 'Q1'] },
];
const fields = { row: ['Region', 'City'], column: ['Year', 'Quarter'] } as const;
const memberPath = (axis: Axis, values: readonly string[]): MemberPath => values.map((value, depth) => ({ fieldRef: fields[axis][depth], value: toTypedValue(value) }));

/** Host-prepared leaf and parent rows. Parent constants do not depend on leaf values. */
export function createControlledDemo() {
    const plan: RenderPlan = {
        domainPlanKey: 'controlled-bars-v1', mark: 'bar', stack: 'none', barOrientation: 'vertical',
        bindings: ['Region', 'City', 'Year', 'Quarter', 'Category', 'Value'].map((fieldRef) => ({
            fieldRef, bindingId: `controlled:${fieldRef}`, columnKey: fieldRef, label: fieldRef,
            valueType: fieldRef === 'Value' ? 'number' : 'string',
            positionType: fieldRef === 'Value' ? 'linear' : 'band',
        })),
        rows: { facets: fields.row, positions: ['Value'] },
        columns: { facets: fields.column, positions: ['Category'] },
        channels: { color: { fieldRef: 'Category' } },
        scales: { Value: { zero: true } },
        axes: { Value: { format: ',.0f' } },
        style: { fontSize: 11, barWidth: 18 },
    };
    const records: Record<string, unknown>[] = [];
    const rowPaths = rowMembers.flatMap(({ name, children }) => [[name], ...children.map((child) => [name, child])]);
    const columnPaths = columnMembers.flatMap(({ name, children }) => [[name], ...children.map((child) => [name, child])]);
    const leafPairs = [[12, 24], [18, 31], [22, 39], [16, 28]] as const;
    for (const [rowIndex, row] of rowPaths.entries()) for (const [columnIndex, column] of columnPaths.entries()) {
        // This missing parent is deliberate even though all of its children exist.
        if (row.length === 1 && row[0] === 'West' && column[0] === '2026') continue;
        const values = row.length === 1 && column.length === 1 ? [140, 155]
            : row.length === 1 ? [70, 85]
            : column.length === 1 ? [95, 115]
            : leafPairs[(rowIndex + columnIndex) % leafPairs.length];
        for (const [index, Category] of ['Standard', 'Premium'].entries()) records.push({
            __datumKey: JSON.stringify(['controlled', row, column, Category]),
            __rowDepth: row.length, __columnDepth: column.length,
            Region: row[0], City: row[1] ?? null, Year: column[0], Quarter: column[1] ?? null,
            Category, Value: values[index],
            SuppliedGrain: `${row.length === 1 ? 'Region parent' : 'City leaf'} / ${column.length === 1 ? 'Year parent' : 'Quarter leaf'}`,
        });
    }
    const collapsed = { row: new Set<string>(), column: new Set<string>() };
    const orders = new Map<string, MemberOrder>();
    let presentation = 1;
    let lastRequest: { requestId: string; kind: string; status: string } | undefined;
    const getRecordPath = (record: PreparedRecord, _index: number, axis: Axis) => memberPath(axis,
        fields[axis].slice(0, Number(record[axis === 'row' ? '__rowDepth' : '__columnDepth'])).map((field) => String(record[field])));
    const visible = (axis: Axis) => (axis === 'row' ? rowMembers : columnMembers).flatMap(({ name, children }) => {
        const parent = memberPath(axis, [name]);
        return collapsed[axis].has(pathKey(parent)) ? [{ path: parent, collapsed: true }]
            : children.map((child) => ({ path: memberPath(axis, [name, child]), collapsed: false }));
    });
    const buildInput = (): WorksheetInput => ({ plan, source: createPreparedDataSource({
        version: { sourceId: 'controlled-prepared-demo', snapshotId: 'prepared-v1', presentationId: `display-${presentation}` },
        plan, records, getDatumKey: (record) => String(record.__datumKey), identityScope: 'stable',
        axisMembers: { row: visible('row'), column: visible('column') }, getRecordPath, memberOrder: [...orders.values()],
    }) });
    let input = buildInput();
    const target = (axis: Axis, name: string): HeaderRequestTarget => {
        const path = memberPath(axis, [name]);
        return { axis, path, key: headerKey(axis, path), fieldRef: fields[axis][0] };
    };
    return {
        description: 'Click a Region or Year header to collapse or expand. Focus the chart and press H, arrows and Enter for keyboard control; S sorts siblings ascending. Parent bars use supplied constants: Region 70/85, Year 95/115, both 140/155. West × 2026 has no Region parent record and stays empty when West is collapsed.',
        delayMs: 550,
        plan, records, target,
        getInput: () => input,
        getState: () => ({ version: { ...input.source.version }, collapsed: { row: [...collapsed.row], column: [...collapsed.column] },
            orders: [...orders.values()], lastRequest }),
        async accept(request: ControlledRequest, isCurrent: () => boolean = () => true): Promise<WorksheetInput | undefined> {
            await new Promise((resolve) => setTimeout(resolve, 550));
            if (!isCurrent() || request.basePresentationId !== input.source.version.presentationId) return undefined;
            const { axis, path, key, fieldRef } = request.target;
            const catalog = axis === 'row' ? rowMembers : columnMembers;
            const values = path.map((member) => member.value.type === 'string' ? member.value.value : undefined);
            const parent = catalog.find((member) => member.name === values[0]);
            const valid = path.length >= 1 && path.length <= 2 && key === headerKey(axis, path)
                && fieldRef === fields[axis][path.length - 1] && path.every((member, depth) => member.fieldRef === fields[axis][depth])
                && parent && (path.length === 1 || parent.children.includes(values[1] ?? ''));
            let reason: string | undefined;
            if (!valid) reason = 'The requested header is outside this prepared fixture.';
            else if (request.kind === 'collapse') {
                if (path.length !== 1 || !('expanded' in request.intent)) reason = 'Only Region and Year headers can collapse.';
                else if (request.intent.expanded) collapsed[axis].delete(pathKey(path));
                else collapsed[axis].add(pathKey(path));
            } else if (!('direction' in request.intent)) reason = 'Sorting needs an explicit direction.';
            else {
                const siblings = path.length === 1 ? catalog.map((member) => member.name) : [...parent!.children];
                siblings.sort((a, b) => a.localeCompare(b));
                if (request.intent.direction === 'descending') siblings.reverse();
                const parentPath = path.slice(0, -1);
                orders.set(JSON.stringify([axis, pathKey(parentPath)]), { axis, parent: parentPath, fieldRef, values: siblings.map((value) => toTypedValue(value)) });
            }
            const status = reason ? 'rejected' : 'accepted';
            if (!reason) { presentation++; input = buildInput(); }
            lastRequest = { requestId: request.requestId, kind: request.kind, status };
            return { ...input, requestResults: [{ requestId: request.requestId, status, ...(reason ? { reason } : {}) }] };
        },
    };
}
