import { IExpression, IField } from '../interfaces';
import { walkFid } from '../lib/sql';

/**
 * Validation pass over the field set that feeds `toWorkflow` (the dimensions/measures
 * pools). It catches, before any computation runs, the failure classes that the
 * workflow pipeline otherwise turns into silently wrong data:
 *
 * - `missing-field`: a computed field references a fid (or, inside a SQL expression,
 *   a name) that resolves to nothing. `replaceFid` passes unresolved SQL refs through
 *   verbatim and the client executor evaluates missing columns to nullish values.
 * - `cyclic-dependency`: computed fields that depend on each other. `treeShake` in
 *   utils/workflow.ts terminates on cycles (its work list strictly shrinks) but emits
 *   an unsatisfiable transform order, so every field in the cycle computes garbage.
 * - `duplicate-fid`: two pool fields sharing one fid; transforms write the same
 *   column key and the group-by silently reads whichever ran last.
 *
 * Pure and additive: nothing in the existing pipeline calls it implicitly except
 * `normalize()`, which is a new strict entry.
 */
export type IWorkflowFieldIssue =
    { type: 'missing-field'; fid: string; missing: string } | { type: 'cyclic-dependency'; cycle: string[] } | { type: 'duplicate-fid'; fid: string };

type FieldLike = Pick<IField, 'fid' | 'name' | 'computed' | 'expression'>;

/** Dependencies of one expression, split by how they must be resolved (mirrors walkExpression + replaceFid). */
function expressionDeps(expression: IExpression): { fids: string[]; sqlRefs: string[] } {
    const fids: string[] = [];
    const sqlRefs: string[] = [];
    const walk = (exp: IExpression) => {
        for (const param of exp.params) {
            if (param.type === 'field') {
                fids.push(param.value);
            } else if (param.type === 'expression') {
                walk(param.value);
            } else if (param.type === 'sql') {
                try {
                    sqlRefs.push(...walkFid(param.value));
                } catch {
                    // unparsable SQL is surfaced elsewhere (execution/normalize); not this pass's job
                }
            } else if (param.type === 'map') {
                fids.push(param.value.x, param.value.y);
            } else if (param.type === 'newmap') {
                param.value.facets.flatMap((x) => x.dimensions).forEach((x) => fids.push(x.fid));
            }
        }
    };
    walk(expression);
    return { fids, sqlRefs };
}

/**
 * @param fields the field pools that feed `toWorkflow` (dimensions + measures).
 * @param knownFields the dataset schema (`IMutField[]`-like). Field existence can only be
 * judged against the dataset — computed expressions may legitimately reference raw data
 * columns that are not in the chart pools (the executors read them from the raw rows).
 * When omitted, the `missing-field` check is skipped and only the intrinsic structural
 * checks (cycles, duplicate fids) run.
 */
export function validateWorkflowFields(fields: readonly FieldLike[], knownFields?: readonly { fid: string; name?: string }[]): IWorkflowFieldIssue[] {
    const issues: IWorkflowFieldIssue[] = [];
    const checkExistence = knownFields !== undefined;

    const fidSet = new Set<string>();
    for (const field of fields) {
        if (fidSet.has(field.fid)) {
            issues.push({ type: 'duplicate-fid', fid: field.fid });
        }
        fidSet.add(field.fid);
    }
    const knownFids = new Set(fidSet);
    for (const field of knownFields ?? []) {
        knownFids.add(field.fid);
    }

    // Same resolution dict as replaceFid (lib/sql.ts): lowercased (name ?? fid) → fid.
    const sqlDict = new Map<string, string>();
    for (const field of [...fields, ...(knownFields ?? [])]) {
        const key = (field.name ?? field.fid).toLowerCase();
        if (!sqlDict.has(key)) {
            sqlDict.set(key, field.fid);
        }
    }

    const computed = fields.filter((f) => f.expression);
    const edges = new Map<string, string[]>();
    for (const field of computed) {
        const { fids, sqlRefs } = expressionDeps(field.expression!);
        const deps: string[] = [];
        for (const dep of fids) {
            if (!knownFids.has(dep)) {
                if (checkExistence) {
                    issues.push({ type: 'missing-field', fid: field.fid, missing: dep });
                }
            } else {
                deps.push(dep);
            }
        }
        for (const ref of sqlRefs) {
            const resolved = sqlDict.get(ref.toLowerCase());
            if (resolved === undefined) {
                if (checkExistence) {
                    issues.push({ type: 'missing-field', fid: field.fid, missing: ref });
                }
            } else {
                deps.push(resolved);
            }
        }
        edges.set(
            field.fid,
            deps.filter((dep) => dep !== field.fid),
        );
    }
    // self-references are cycles of length one
    for (const field of computed) {
        const { fids, sqlRefs } = expressionDeps(field.expression!);
        const selfBySql = sqlRefs.some((ref) => sqlDict.get(ref.toLowerCase()) === field.fid);
        if (fids.includes(field.fid) || selfBySql) {
            issues.push({ type: 'cyclic-dependency', cycle: [field.fid, field.fid] });
        }
    }

    // three-color DFS over computed-to-computed edges
    const state = new Map<string, 'visiting' | 'done'>();
    const stack: string[] = [];
    const visit = (fid: string): void => {
        const current = state.get(fid);
        if (current === 'done') return;
        if (current === 'visiting') {
            const start = stack.indexOf(fid);
            issues.push({ type: 'cyclic-dependency', cycle: [...stack.slice(start), fid] });
            return;
        }
        state.set(fid, 'visiting');
        stack.push(fid);
        for (const dep of edges.get(fid) ?? []) {
            if (edges.has(dep)) {
                visit(dep);
            }
        }
        stack.pop();
        state.set(fid, 'done');
    };
    for (const fid of edges.keys()) {
        visit(fid);
    }

    return issues;
}

export function assertValidWorkflowFields(fields: readonly FieldLike[], knownFields?: readonly { fid: string; name?: string }[]): void {
    const issues = validateWorkflowFields(fields, knownFields);
    if (issues.length === 0) return;
    const lines = issues.map((issue) => {
        switch (issue.type) {
            case 'missing-field':
                return `computed field '${issue.fid}' references unknown field '${issue.missing}'`;
            case 'cyclic-dependency':
                return `cyclic computed-field dependency: ${issue.cycle.join(' -> ')}`;
            case 'duplicate-fid':
                return `duplicate fid '${issue.fid}' in the field pools`;
        }
    });
    throw new Error(`Invalid field set for workflow computation:\n- ${lines.join('\n- ')}`);
}
