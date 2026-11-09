import { resultKey, type AxisBranch, type AxisExpr, type Binding, type Computation, type FieldInstance, type Plan, type QueryTask, type Row, type WorksheetSpec } from './types';

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
        if (f.aggregate ? f.display !== 'continuous' : f.display !== 'discrete') throw new Error('Color takes a discrete dimension or an aggregated measure.');
        encodings.unshift(f);
    }
    if (spec.text && spec.mark === 'text') encodings.push(instance(spec.text, 'Text'));
    const tasks = new Map<string, QueryTask>();
    const bindings: Binding[] = [];
    for (const row of rows) for (const column of columns) {
        if (spec.mark === 'bar' && Number(row.position?.display === 'continuous') + Number(column.position?.display === 'continuous') !== 1) {
            throw new Error('Bar marks require exactly one continuous positional field.');
        }
        const used = [...branchFields(row), ...branchFields(column), ...encodings];
        const groupBy = [...new Set(used.filter(f => !f.aggregate).map(f => f.field))].sort();
        const id = JSON.stringify(groupBy);
        let task = tasks.get(id);
        if (!task) {
            task = { id, groupBy, measures: [], payload: { workflow: [] } };
            tasks.set(id, task);
        }
        for (const f of used.filter(f => f.aggregate)) if (!task.measures.some(m => m.id === f.id)) task.measures.push(f);
        bindings.push({ row, column, taskId: id });
    }
    for (const task of tasks.values()) {
        // Alias collisions must fail before dispatch rather than overwrite grouped data.
        if (task.measures.some(m => task.groupBy.includes(resultKey(m)))) throw new Error('A source field conflicts with a reserved worksheet result alias.');
        task.payload = { workflow: [
            ...(spec.filters?.length ? [{ type: 'filter' as const, filters: spec.filters.map(f => ({ fid: f.field, rule: { type: 'one of' as const, value: f.values } })) }] : []),
            { type: 'view', query: [{ op: 'aggregate', groupBy: task.groupBy,
                measures: task.measures.map(m => ({ field: m.field, agg: m.aggregate!, asFieldKey: resultKey(m) })) }] },
        ] };
    }
    return { spec, rows, columns, tasks: [...tasks.values()], bindings };
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
