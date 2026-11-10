import { resultKey, type AxisBranch, type AxisExpr, type Binding, type Computation, type FieldInstance, type Plan, type QueryTask, type Ranking, type Row, type WorksheetSpec } from './types';

function expand(expr: AxisExpr): string[][] {
    if (expr.kind === 'empty') return [[]];
    if (expr.kind === 'field') return [[expr.instanceId]];
    if (!expr.items.length) throw new Error(`${expr.kind} must contain at least one expression.`);
    if (expr.kind === 'concat') {
        const branches = expr.items.flatMap(expand);
        if (branches.length > 256) throw new Error('V0 supports at most 256 axis branches. Reduce concatenated alternatives.');
        return branches;
    }
    return expr.items.reduce<string[][]>((left, item) => {
        const right = expand(item);
        if (left.length * right.length > 256) throw new Error('V0 supports at most 256 axis branches. Reduce crossed alternatives.');
        return left.flatMap(a => right.map(b => [...a, ...b]));
    }, [[]]);
}

export function compileAxis(expr: AxisExpr, instances: WorksheetSpec['instances'], axis: string): AxisBranch[] {
    return expand(expr).map((ids, order) => {
        if (new Set(ids).size !== ids.length) throw new Error('An axis branch cannot contain the same field instance twice.');
        const fields = ids.map(id => {
            const f = instances[id];
            if (!f || f.id !== id) throw new Error(`Unknown or inconsistent field instance: ${id}`);
            if (f.aggregate && f.display === 'discrete') throw new Error('Discrete aggregated fields are not supported in V0.');
            return f;
        });
        const position = fields[fields.length - 1];
        const facets = fields.slice(0, -1);
        if (facets.some(f => f.display !== 'discrete' || f.aggregate)) {
            throw new Error('Continuous fields must terminate an axis branch. Use concat for multiple measures.');
        }
        return { id: `${axis}:${JSON.stringify(ids)}:${order}`, facets, position, order };
    });
}

export function branchFields(branch: AxisBranch): FieldInstance[] {
    return branch.position ? [...branch.facets, branch.position] : branch.facets;
}
/**
 * The axis that carries a bar's length. With two continuous fields it is the aggregated
 * one; the other is a position along which bars are placed, such as a date.
 */
export function valueAxis(x?: FieldInstance, y?: FieldInstance): 'x' | 'y' | undefined {
    const xContinuous = x?.display === 'continuous', yContinuous = y?.display === 'continuous';
    if (xContinuous && yContinuous) return y!.aggregate && !x!.aggregate ? 'y' : 'x';
    return xContinuous ? 'x' : yContinuous ? 'y' : undefined;
}

/** Query tasks are deduplicated by grain, never by pane. No dependency on Vega. */
export function compileWorksheet(spec: WorksheetSpec): Plan {
    if (spec.kind !== 'worksheet' || spec.specVersion !== 2) throw new Error('Expected WorksheetSpec version 2.');
    const rows = compileAxis(spec.rows, spec.instances, 'row');
    const columns = compileAxis(spec.columns, spec.instances, 'column');
    const instance = (id: string, role: string) => {
        const f = spec.instances[id];
        if (!f) throw new Error(`Unknown field instance on ${role}: ${id}`);
        return f;
    };
    const details = (spec.detail ?? []).map(id => {
        const f = instance(id, 'Detail');
        if (f.aggregate || f.display !== 'discrete') throw new Error('Detail requires discrete, unaggregated field instances.');
        return f;
    });
    const encodings = [...details];
    if (spec.color) {
        const f = instance(spec.color, 'Color');
        if (f.aggregate && f.display !== 'continuous') throw new Error('Color takes a dimension or a continuous field, not a discrete aggregate.');
        if (spec.mark === 'boxplot' && f.display !== 'discrete') throw new Error('A box plot takes a dimension on color.');
        encodings.unshift(f);
    }
    if (spec.text && spec.mark === 'text') encodings.push(instance(spec.text, 'Text'));
    if (spec.angle && spec.mark === 'arc') {
        const f = instance(spec.angle, 'Angle');
        if (f.display !== 'continuous' || f.scale === 'time') throw new Error('Angle takes a measure.');
        encodings.push(f);
    }
    const tasks = new Map<string, QueryTask>();
    const bindings: Binding[] = [];
    for (const row of rows) for (const column of columns) {
        const continuous = [row.position, column.position].filter(f => f?.display === 'continuous');
        if (spec.mark === 'bar' && (!continuous.length || (continuous.length === 2 && continuous.filter(f => f!.aggregate).length !== 1))) {
            throw new Error('Bar marks need one measure axis. The other axis can be discrete, or an unaggregated continuous field such as a date.');
        }
        if (spec.mark === 'arc' && continuous.length) throw new Error('Arc marks take dimensions on rows and columns. The measure goes on angle.');
        if (spec.mark === 'boxplot' && (continuous.length !== 1 || continuous[0]!.scale === 'time')) {
            throw new Error('A box plot needs exactly one measure axis. The other axis takes dimensions.');
        }
        const used = [...branchFields(row), ...branchFields(column), ...encodings];
        const groupBy = [...new Set(used.filter(f => !f.aggregate).map(f => f.field))].sort();
        // A box over an unaggregated field summarises source rows, so equal rows must not be merged.
        const raw = spec.mark === 'boxplot' && !continuous[0]!.aggregate;
        const id = JSON.stringify(groupBy);
        let task = tasks.get(id);
        if (!task) {
            task = { id, groupBy, measures: [], raw, payload: { workflow: [] } };
            tasks.set(id, task);
        }
        for (const f of used.filter(f => f.aggregate)) if (!task.measures.some(m => m.id === f.id)) task.measures.push(f);
        bindings.push({ row, column, taskId: id });
    }
    // A row limit applies to the records that become marks, never to the values that only order members.
    const limit = spec.limit && spec.limit.rows > 0 ? spec.limit : undefined;
    const limitBy = limit?.by ? instance(limit.by, 'Limit') : undefined;
    const limited = new Map<string, FieldInstance | undefined>();
    if (limit) for (const task of tasks.values()) {
        // An aggregate joins the query; a plain field can order the rows only where it is part of the grain.
        if (limitBy?.aggregate && !task.raw && !task.measures.some(m => m.id === limitBy.id)) task.measures.push(limitBy);
        limited.set(task.id, limitBy && (limitBy.aggregate ? !task.raw : task.groupBy.includes(limitBy.field)) ? limitBy : undefined);
    }
    // Members ordered by a measure need that measure per member, at the grain of the member's own
    // axis path. Where a query of that grain already exists the measure joins it.
    const rankings: Ranking[] = [];
    for (const [id, order] of Object.entries(spec.order ?? {})) {
        if (typeof order !== 'object' || Array.isArray(order)) continue;
        const { by: byId, direction = 'ascending' } = order as { by: string; direction?: 'ascending' | 'descending' };
        const f = instance(id, 'Order'), by = instance(byId, 'Order');
        if (f.display !== 'discrete') throw new Error(`Only the members of a dimension can be ordered by a measure: ${f.label}`);
        if (!by.aggregate || by.display !== 'continuous') throw new Error(`Members are ordered by an aggregated measure, not by ${by.label}.`);
        for (const branch of [...rows, ...columns]) {
            const fields = branchFields(branch), index = fields.indexOf(f);
            if (index < 0) continue;
            const parents = fields.slice(0, index);
            if (rankings.some(r => r.instanceId === id && r.parents.length === parents.length && r.parents.every((p, i) => p === parents[i]))) continue;
            const groupBy = [...new Set([...parents, f].map(p => p.field))].sort();
            const taskId = JSON.stringify(groupBy);
            let task = tasks.get(taskId);
            // A query that returns source rows or is cut by the limit cannot also carry complete totals.
            if (task?.raw || (task && limited.has(taskId))) task = undefined;
            const rankId = task ? taskId : `order:${taskId}`;
            if (!task && !(task = tasks.get(rankId))) tasks.set(rankId, task = { id: rankId, groupBy, measures: [], payload: { workflow: [] } });
            if (!task.measures.some(m => m.id === by.id)) task.measures.push(by);
            rankings.push({ instanceId: id, parents, by, direction, taskId: rankId });
        }
    }
    for (const task of tasks.values()) {
        // Alias collisions must fail before dispatch rather than overwrite grouped data.
        if (task.measures.some(m => task.groupBy.includes(resultKey(m)))) throw new Error('A source field conflicts with a reserved worksheet result alias.');
        task.payload = { workflow: [
            ...(spec.filters?.length ? [{ type: 'filter' as const, filters: spec.filters.map(f => ({ fid: f.field, rule: { type: 'one of' as const, value: f.values } })) }] : []),
            { type: 'view', query: [task.raw ? { op: 'raw', fields: task.groupBy } : { op: 'aggregate', groupBy: task.groupBy,
                measures: task.measures.map(m => ({ field: m.field, agg: m.aggregate!, asFieldKey: resultKey(m) })) }] },
            ...(limited.get(task.id) ? [{ type: 'sort' as const, by: [resultKey(limited.get(task.id)!)], sort: limit!.direction ?? 'ascending' }] : []),
        ], ...(limited.has(task.id) ? { limit: limit!.rows } : {}) };
    }
    return { spec, rows, columns, tasks: [...tasks.values()], bindings, rankings };
}

export async function executePlan(plan: Plan, computation: Computation, signal?: AbortSignal): Promise<Map<string, Row[]>> {
    const results = new Map<string, Row[]>();
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, plan.tasks.length) }, async () => {
        while (next < plan.tasks.length) {
            signal?.throwIfAborted();
            const task = plan.tasks[next++];
            const rows = await computation(task.payload);
            signal?.throwIfAborted();
            results.set(task.id, rows);
        }
    }));
    return results;
}
