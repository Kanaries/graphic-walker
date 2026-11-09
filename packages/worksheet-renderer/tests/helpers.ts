import { compileWorksheet, executePlan } from '../src/compiler';
import { buildModel } from '../src/model';
import { buildScene } from '../src/scene';
import { valueKey } from '../src/keys';
import type { Aggregate, Computation, Row, WorksheetSpec } from '../src/types';

export function fields(dimensions: string[], measures: Record<string, [string, Aggregate]> = {}): WorksheetSpec['instances'] {
    return Object.fromEntries([
        ...dimensions.map(id => ({ id, field: id, label: id, display: 'discrete' as const })),
        ...Object.entries(measures).map(([id, [field, aggregate]]) => ({ id, field, label: id.toUpperCase(), display: 'continuous' as const, aggregate })),
    ].map(f => [f.id, f]));
}

// Independent reference evaluator. Tests validate generated workflows against raw rows,
// including non-additive aggregates and typed grouping keys. A group without any
// non-null input yields null, as SQL aggregates do.
export function reference(data: Row[]): Computation {
    return async payload => {
        let rows = data;
        for (const step of payload.workflow) {
            if (step.type === 'filter') rows = rows.filter(r => step.filters.every(f => f.rule.value.some(v => valueKey(v) === valueKey(r[f.fid]))));
            else {
                const q = step.query[0];
                const groups = new Map<string, Row[]>();
                for (const row of rows) {
                    const key = JSON.stringify(q.groupBy.map(f => valueKey(row[f])));
                    const bucket = groups.get(key) ?? []; bucket.push(row); groups.set(key, bucket);
                }
                rows = [...groups.values()].map(bucket => {
                    const output = Object.fromEntries(q.groupBy.map(f => [f, bucket[0][f]]));
                    for (const m of q.measures) {
                        const values = bucket.map(r => r[m.field]).filter(v => v != null);
                        const total = values.reduce((n, v) => n + Number(v), 0);
                        output[m.asFieldKey] = m.agg === 'count' ? values.length : m.agg === 'distinctCount' ? new Set(values.map(valueKey)).size
                            : !values.length ? null : m.agg === 'sum' ? total : m.agg === 'mean' ? total / values.length : m.agg === 'min' ? Math.min(...values) : Math.max(...values);
                    }
                    return output;
                });
            }
        }
        return rows;
    };
}

export async function model(spec: WorksheetSpec, rows: Row[]) {
    const plan = compileWorksheet(spec);
    return buildModel(plan, await executePlan(plan, reference(rows)));
}
export type Model = Awaited<ReturnType<typeof model>>;
export const fullScene = (m: Model) => buildScene(m, { x: 0, y: 0, width: m.width, height: m.height });
export const near = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance;
