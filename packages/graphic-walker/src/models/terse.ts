import {
    DraggableFieldState,
    IAggregator,
    IChart,
    IFilterField,
    IFilterRule,
    IMutField,
    IViewField,
    PartialChart,
    TerseComputedField,
    TerseFieldRef,
    TerseFilter,
    TerseSpec,
    TerseSpecSchemaUrl,
} from '../interfaces';
import { newChart } from './visSpecHistory';
import { getSQLItemAnalyticType, parseSQLExpr } from '../lib/sql';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID } from '../constants';
import { emptyVisualConfig, emptyVisualLayout } from '../utils/save';

type OnWarn = (message: string) => void;

// Shorthand aggregates: IAggregator minus 'expr' (aggregate expressions have no
// sensible shorthand syntax and must go through inline computed fields).
type ShorthandAgg = Exclude<IAggregator, 'expr'>;
const SHORTHAND_AGGS = new Set<IAggregator>(['sum', 'count', 'max', 'min', 'mean', 'median', 'variance', 'stdev', 'distinctCount']);

function asShorthandAgg(aggName: string | undefined): ShorthandAgg | undefined {
    return aggName !== undefined && SHORTHAND_AGGS.has(aggName as IAggregator) ? (aggName as ShorthandAgg) : undefined;
}

// terse channel key → canonical encoding channel
const CHANNEL_MAP = {
    x: 'columns',
    y: 'rows',
    color: 'color',
    opacity: 'opacity',
    size: 'size',
    shape: 'shape',
    text: 'text',
    details: 'details',
    theta: 'theta',
    radius: 'radius',
    longitude: 'longitude',
    latitude: 'latitude',
    geoId: 'geoId',
} as const;
type TerseChannelKey = keyof typeof CHANNEL_MAP;
const TERSE_CHANNEL_KEYS = Object.keys(CHANNEL_MAP) as TerseChannelKey[];

/** Deterministic djb2-based short hash so the same inline computed name always yields the same fid (idempotency). */
function shortHash(input: string): string {
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
        h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

export function terseComputedFid(name: string): string {
    return `gw_t_${shortHash(name)}`;
}

function levenshtein(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return dp[a.length][b.length];
}

/**
 * Parse the aggregate shorthand: `aggName '(' fieldRef ')'` where aggName must be
 * exactly one of the shorthand aggregates and the parens are the outermost pair.
 * Anything else is returned as a plain field name (e.g. `'log(x)'`).
 */
export function parseShorthand(ref: string): { field: string; aggregate?: IAggregator } {
    const match = /^([a-zA-Z]+)\((.*)\)$/.exec(ref);
    if (match && SHORTHAND_AGGS.has(match[1] as IAggregator)) {
        return { field: match[2], aggregate: match[1] as IAggregator };
    }
    return { field: ref };
}

class FieldIndex {
    private byName = new Map<string, IViewField[]>();
    private byFid = new Map<string, IViewField>();
    private names: string[] = [];

    add(field: IViewField) {
        // Virtual fields may have no display name when i18n is not initialized (e.g. headless use).
        if (typeof field.name === 'string') {
            const named = this.byName.get(field.name);
            if (named) {
                named.push(field);
            } else {
                this.byName.set(field.name, [field]);
                this.names.push(field.name);
            }
        }
        if (!this.byFid.has(field.fid)) {
            this.byFid.set(field.fid, field);
        }
    }

    hasFid(fid: string): boolean {
        return this.byFid.has(fid);
    }

    /**
     * Exact-only lookup (name, then fid) with no case-insensitive fallback and no
     * error; used by the literal-name-wins rule before the shorthand reading.
     */
    resolveExact(raw: string): IViewField | null {
        const named = this.byName.get(raw);
        if (named) {
            if (named.length > 1) {
                throw new Error(`Field name '${raw}' is ambiguous between fids [${named.map((f) => f.fid).join(', ')}]; reference it with a 'fid:' prefix.`);
            }
            return named[0];
        }
        return this.byFid.get(raw) ?? null;
    }

    /**
     * Resolution order (docs/terse-spec-design.md §3): `fid:` prefix → exact name
     * (inline computed fields are in the same index) → exact fid → case-insensitive
     * unique fallback (with warning) → error with nearest candidates.
     */
    resolve(raw: string, onWarn: OnWarn): IViewField {
        if (raw.startsWith('fid:')) {
            const field = this.byFid.get(raw.slice(4));
            if (!field) {
                throw new Error(`Unknown field id '${raw.slice(4)}' (from '${raw}'). ${this.candidateHint(raw.slice(4))}`);
            }
            return field;
        }
        const named = this.byName.get(raw);
        if (named) {
            if (named.length > 1) {
                throw new Error(`Field name '${raw}' is ambiguous between fids [${named.map((f) => f.fid).join(', ')}]; reference it with a 'fid:' prefix.`);
            }
            return named[0];
        }
        const byFid = this.byFid.get(raw);
        if (byFid) {
            return byFid;
        }
        const lower = raw.toLowerCase();
        const caseHits = this.names.filter((n) => n.toLowerCase() === lower);
        if (caseHits.length === 1) {
            onWarn(`Field '${raw}' matched '${caseHits[0]}' case-insensitively.`);
            return this.byName.get(caseHits[0])![0];
        }
        if (caseHits.length > 1) {
            throw new Error(`Field '${raw}' matches multiple fields case-insensitively [${caseHits.join(', ')}]; use the exact name.`);
        }
        throw new Error(`Unknown field '${raw}'. ${this.candidateHint(raw)}`);
    }

    candidateHint(raw: string): string {
        const nearest = [...this.names].sort((a, b) => levenshtein(raw, a) - levenshtein(raw, b)).slice(0, 3);
        return `Nearest candidates: [${nearest.join(', ')}] among ${this.names.length} fields.`;
    }
}

/**
 * Build the inline computed fields, mirroring the store actions byte-for-byte:
 * `expr` mirrors `addSQLComputedField`, `bin`/`log` mirror `createBinlogField`.
 */
function buildComputedFields(defs: TerseComputedField[], index: FieldIndex, poolFields: IViewField[], onWarn: OnWarn): IViewField[] {
    const results: IViewField[] = [];
    const seen = new Map<string, string>();
    for (const def of defs) {
        const kinds = [def.expr !== undefined, def.bin !== undefined, def.log !== undefined].filter(Boolean).length;
        if (kinds !== 1) {
            throw new Error(`Computed field '${def.name}' must define exactly one of expr / bin / log.`);
        }
        const definition = JSON.stringify([def.expr, def.bin, def.log, def.analyticType]);
        const previous = seen.get(def.name);
        if (previous !== undefined) {
            if (previous !== definition) {
                throw new Error(`Computed field '${def.name}' is defined twice with different definitions.`);
            }
            continue;
        }
        seen.set(def.name, definition);
        const fid = terseComputedFid(def.name);
        if (index.hasFid(fid)) {
            throw new Error(`Computed field '${def.name}' hashes to fid '${fid}', which is already taken by another field; rename the computed field.`);
        }
        let field: IViewField;
        if (def.expr !== undefined) {
            let parsed;
            try {
                parsed = parseSQLExpr(def.expr);
            } catch (error) {
                throw new Error(`Computed field '${def.name}' has an invalid expression '${def.expr}': ${error instanceof Error ? error.message : error}`);
            }
            const [semanticType, isAgg] = getSQLItemAnalyticType(parsed, poolFields.concat(results) as IMutField[]);
            const analyticType = def.analyticType ?? (semanticType === 'quantitative' ? 'measure' : 'dimension');
            field = {
                analyticType,
                fid,
                name: def.name,
                semanticType,
                computed: true,
                aggName: isAgg ? 'expr' : analyticType === 'dimension' ? undefined : 'sum',
                expression: { op: 'expr', as: fid, params: [{ type: 'sql', value: def.expr }] },
            };
        } else if (def.bin) {
            const base = index.resolve(def.bin.field, onWarn);
            const num = def.bin.count ?? 10;
            field = {
                fid,
                name: def.name,
                semanticType: 'ordinal',
                analyticType: def.analyticType ?? 'dimension',
                computed: true,
                expression: { op: 'bin', as: fid, params: [{ type: 'field', value: base.fid }], num },
            };
        } else {
            const base = index.resolve(def.log!.field, onWarn);
            const num = def.log!.base ?? 10;
            const op = num === 10 ? 'log10' : num === 2 ? 'log2' : 'log';
            field = {
                fid,
                name: def.name,
                semanticType: 'quantitative',
                analyticType: def.analyticType ?? base.analyticType,
                aggName: 'sum',
                computed: true,
                expression: { op, as: fid, params: [{ type: 'field', value: base.fid }], num },
            };
        }
        index.add(field);
        results.push(field);
    }
    return results;
}

/**
 * Resolve a string reference: `fid:` prefix, then a field literally named the
 * whole string (exact match only — this wins over the shorthand reading, with a
 * warning), then the aggregate shorthand, then plain resolution.
 */
function resolveStringField(raw: string, index: FieldIndex, onWarn: OnWarn): { base: IViewField; aggregate?: IAggregator } {
    if (raw.startsWith('fid:')) {
        return { base: index.resolve(raw, onWarn) };
    }
    const shorthand = parseShorthand(raw);
    if (shorthand.aggregate === undefined) {
        return { base: index.resolve(raw, onWarn) };
    }
    const literal = index.resolveExact(raw);
    if (literal) {
        onWarn(`'${raw}' resolved to a field literally named '${raw}', not as the ${shorthand.aggregate} shorthand.`);
        return { base: literal };
    }
    if (shorthand.field === '') {
        if (shorthand.aggregate !== 'count') {
            throw new Error(`Aggregate shorthand '${raw}' needs a field, e.g. '${shorthand.aggregate}(Sales)'.`);
        }
        return { base: index.resolve(`fid:${COUNT_FIELD_ID}`, onWarn) };
    }
    return { base: index.resolve(shorthand.field, onWarn), aggregate: shorthand.aggregate };
}

/**
 * Mirror of the store's `createDateDrillField` action (visSpecHistory.ts): a terse
 * `timeUnit` expands to a real dateTimeDrill computed field on the channel, so the
 * drill affects the query group-by exactly like the UI drill — not just axis display.
 */
function createDrillField(base: IViewField, timeUnit: NonNullable<IViewField['timeUnit']>, aggName: IAggregator | undefined, onWarn: OnWarn): IViewField {
    if (base.semanticType !== 'temporal') {
        onWarn(`timeUnit '${timeUnit}' applied to non-temporal field '${base.name}' (${base.semanticType}); existing drill semantics parse values as dates.`);
    }
    const name = `${timeUnit}(${base.name})`;
    const fid = terseComputedFid(name);
    return {
        fid,
        name,
        semanticType: 'temporal',
        analyticType: base.analyticType,
        aggName: aggName ?? 'sum',
        computed: true,
        timeUnit,
        expression: {
            op: 'dateTimeDrill',
            as: fid,
            params: [
                { type: 'field', value: base.fid },
                { type: 'value', value: timeUnit },
                ...(base.offset != null ? [{ type: 'offset', value: base.offset } as const] : []),
            ],
        },
    };
}

function resolveRef(ref: TerseFieldRef, index: FieldIndex, onWarn: OnWarn, onDrill?: (field: IViewField) => void): IViewField {
    let base: IViewField;
    let overrides: { aggregate?: IAggregator; sort?: 'ascending' | 'descending' | 'none'; timeUnit?: IViewField['timeUnit'] } = {};
    if (typeof ref === 'string') {
        const resolved = resolveStringField(ref, index, onWarn);
        base = resolved.base;
        overrides.aggregate = resolved.aggregate;
    } else {
        // runtime JSON may carry 'expr' even though the type excludes it
        if ((ref.aggregate as string) === 'expr') {
            throw new Error(`Aggregate 'expr' is not allowed on a field reference ('${ref.field}'); use an inline computed field instead.`);
        }
        const resolved = resolveStringField(ref.field, index, onWarn);
        if (resolved.aggregate !== undefined && ref.aggregate !== undefined) {
            throw new Error(`'${ref.field}' already carries a shorthand aggregate; do not set 'aggregate' as well.`);
        }
        base = resolved.base;
        // runtime JSON may still carry 'none' even though the type excludes it
        const sort = (ref.sort as string) === 'none' ? undefined : ref.sort;
        overrides = { aggregate: ref.aggregate ?? resolved.aggregate, sort, timeUnit: ref.timeUnit };
    }
    if (overrides.timeUnit) {
        const drill = createDrillField(base, overrides.timeUnit, overrides.aggregate, onWarn);
        // Same invariant as the inline-computed collision guard: a synthesized drill fid must
        // not collide with any existing field (e.g. a computed field named 'month(Order Date)').
        if (index.hasFid(drill.fid)) {
            throw new Error(`Drill field '${drill.name}' hashes to fid '${drill.fid}', which is already taken by another field; rename the conflicting field.`);
        }
        // The UI appends drill fields to the dimensions/measures pool (datasetFields/utils.ts
        // passes originChannel = 'dimensions' | 'measures'), which is where toWorkflow collects
        // transform steps from — so the pool copy is what makes the drill affect the query.
        onDrill?.(drill);
        const channelCopy = { ...drill };
        if (overrides.sort) channelCopy.sort = overrides.sort;
        return channelCopy;
    }
    const field: IViewField = { ...base };
    if (overrides.aggregate) {
        if (field.analyticType === 'dimension') {
            onWarn(`Aggregate '${overrides.aggregate}' on dimension '${field.name}' follows existing semantics (ignored unless the field acts as a measure).`);
        }
        field.aggName = overrides.aggregate;
    }
    if (overrides.sort) field.sort = overrides.sort;
    return field;
}

function toFilterRule(filter: TerseFilter): IFilterRule {
    if ('oneOf' in filter) return { type: 'one of', value: filter.oneOf };
    if ('notIn' in filter) return { type: 'not in', value: filter.notIn };
    if ('range' in filter) return { type: 'range', value: filter.range };
    if ('timeRange' in filter) return { type: 'temporal range', value: filter.timeRange };
    throw new Error(`Filter on '${(filter as { field: string }).field}' must define one of oneOf / notIn / range / timeRange.`);
}

/**
 * Expand a TerseSpec into a PartialChart (docs/terse-spec-design.md §5).
 * The dimensions/measures pools are rebuilt from `meta` (newChart semantics)
 * plus the inline computed fields; terse never carries pools.
 * Pure: no store, no side effects beyond `onWarn`.
 */
export function expandTerse(spec: TerseSpec, meta: IMutField[], onWarn: OnWarn = (msg) => console.warn(`[terse] ${msg}`)): PartialChart {
    const base = newChart(meta, spec.name || 'Chart');
    const index = new FieldIndex();
    for (const field of [...base.encodings.dimensions, ...base.encodings.measures]) {
        index.add(field);
    }
    const poolFields = [...base.encodings.dimensions, ...base.encodings.measures];
    const computedFields = buildComputedFields(spec.computed ?? [], index, poolFields, onWarn);

    // Pool append order is canonicalized by name so that the declaration order in a terse
    // spec (which projection cannot reconstruct) does not leak into the canonical form.
    const byName = (a: IViewField, b: IViewField) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const sortedComputed = [...computedFields].sort(byName);
    const encodings: Partial<DraggableFieldState> = {
        dimensions: base.encodings.dimensions.concat(sortedComputed.filter((f) => f.analyticType === 'dimension')),
        measures: base.encodings.measures.concat(sortedComputed.filter((f) => f.analyticType === 'measure')),
    };

    const drillFields = new Map<string, IViewField>();
    const collectDrill = (field: IViewField) => {
        if (!drillFields.has(field.fid)) drillFields.set(field.fid, field);
    };
    for (const key of TERSE_CHANNEL_KEYS) {
        const value = spec[key];
        if (value === undefined) continue;
        const refs = Array.isArray(value) ? value : [value];
        encodings[CHANNEL_MAP[key]] = refs.map((ref) => resolveRef(ref, index, onWarn, collectDrill));
    }
    if (drillFields.size > 0) {
        const drills = [...drillFields.values()];
        encodings.dimensions = encodings.dimensions!.concat(drills.filter((f) => f.analyticType === 'dimension'));
        encodings.measures = encodings.measures!.concat(drills.filter((f) => f.analyticType === 'measure'));
    }

    if (spec.filters) {
        encodings.filters = spec.filters.map((filter): IFilterField => {
            const field = index.resolve(filter.field, onWarn);
            return { ...field, rule: toFilterRule(filter) };
        });
    }

    if (spec.sort) {
        const rows = encodings.rows ?? [];
        const lastMeasure = [...rows].reverse().find((f) => f.analyticType === 'measure');
        if (lastMeasure) {
            encodings.rows = rows.map((f) => (f === lastMeasure ? { ...f, sort: spec.sort } : f));
        } else {
            onWarn(`'sort' knob ignored: no measure on y.`);
        }
    }

    const knobConflict = (knob: string, canonicalKey: string) => onWarn(`Both '${knob}' and canonical '${canonicalKey}' are set; the canonical value wins.`);
    if (spec.mark !== undefined && spec.config?.geoms !== undefined) knobConflict('mark', 'config.geoms');
    if (spec.aggregate !== undefined && spec.config?.defaultAggregated !== undefined) knobConflict('aggregate', 'config.defaultAggregated');
    if (spec.limit !== undefined && spec.config?.limit !== undefined) knobConflict('limit', 'config.limit');
    if (spec.stack !== undefined && spec.layout?.stack !== undefined) knobConflict('stack', 'layout.stack');

    return {
        visId: base.visId,
        name: spec.name || 'Chart',
        encodings,
        config: {
            defaultAggregated: spec.aggregate ?? true,
            geoms: [spec.mark ?? 'auto'],
            ...(spec.limit !== undefined ? { limit: spec.limit } : {}),
            ...spec.config,
        },
        layout: {
            ...(spec.stack !== undefined ? { stack: spec.stack } : {}),
            ...spec.layout,
        },
    };
}

const PROJECT_CHANNEL_ENTRIES = Object.entries(CHANNEL_MAP) as [TerseChannelKey, (typeof CHANNEL_MAP)[TerseChannelKey]][];
const SYNTHETIC_FIDS = new Set([MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID]);

/**
 * Project a canonical IChart back into a TerseSpec (docs/terse-spec-design.md §6).
 * Lossy by design: pool fields not referenced by any channel/filter are dropped,
 * and inexpressible pieces (paint / binCount / dateTimeFeature computed fields,
 * regexp filters) are skipped with a warning. Persistence must stay canonical.
 */
export function projectTerse(chart: IChart, onWarn: OnWarn = (msg) => console.warn(`[terse] ${msg}`)): TerseSpec {
    const pools = [...chart.encodings.dimensions, ...chart.encodings.measures];
    const nameCount = new Map<string, Set<string>>();
    for (const field of pools) {
        const set = nameCount.get(field.name) ?? new Set<string>();
        set.add(field.fid);
        nameCount.set(field.name, set);
    }
    const computedDefs = new Map<string, TerseComputedField>();
    const poolByFid = new Map(pools.map((f) => [f.fid, f]));

    const refName = (field: IViewField): string => {
        const fids = nameCount.get(field.name);
        if (!fids || fids.size > 1 || parseShorthand(field.name).aggregate || field.name.startsWith('fid:')) {
            return `fid:${field.fid}`;
        }
        return field.name;
    };

    const poolByName = new Map<string, IViewField>();
    for (const field of pools) {
        if (typeof field.name === 'string' && !poolByName.has(field.name)) {
            poolByName.set(field.name, field);
        }
    }

    // Collect `ref` node names from a parsed SQL expression tree (generic walk keeps us
    // independent of the pgsql-ast-parser node taxonomy).
    const collectSqlRefNames = (node: unknown, out: Set<string>): void => {
        if (Array.isArray(node)) {
            node.forEach((item) => collectSqlRefNames(item, out));
            return;
        }
        if (node && typeof node === 'object') {
            const record = node as Record<string, unknown>;
            if (record.type === 'ref' && typeof record.name === 'string') {
                out.add(record.name);
            }
            Object.values(record).forEach((value) => collectSqlRefNames(value, out));
        }
    };

    // Recursive so computed-on-computed chains (bin of a computed field, expr referencing a
    // computed field by name, drill on a computed base) inline their dependencies too —
    // otherwise the projected spec would reference definitions it does not carry.
    const emitting = new Set<string>();
    const emitComputed = (field: IViewField): boolean => {
        const expression = field.expression;
        if (!expression) return true;
        if (field.fid === COUNT_FIELD_ID) return true;
        if (computedDefs.has(field.name) || emitting.has(field.fid)) return true;
        emitting.add(field.fid);
        try {
            const baseParam = expression.params.find((p) => p.type === 'field');
            const baseField = baseParam ? poolByFid.get(baseParam.value as string) : undefined;
            let def: TerseComputedField;
            switch (expression.op) {
                case 'expr': {
                    const sql = expression.params.find((p) => p.type === 'sql');
                    if (!sql) return false;
                    const refNames = new Set<string>();
                    try {
                        collectSqlRefNames(parseSQLExpr(sql.value as string), refNames);
                    } catch {
                        return false;
                    }
                    for (const depName of refNames) {
                        const dep = poolByName.get(depName);
                        if (dep && (dep.computed || dep.expression) && !emitComputed(dep)) {
                            return false;
                        }
                    }
                    def = { name: field.name, expr: sql.value as string, analyticType: field.analyticType };
                    break;
                }
                case 'bin':
                    if (!baseField || !emitComputed(baseField)) return false;
                    def = { name: field.name, bin: { field: refName(baseField), count: expression.num ?? 10 } };
                    break;
                case 'log':
                case 'log2':
                case 'log10':
                    if (!baseField || !emitComputed(baseField)) return false;
                    def = { name: field.name, log: { field: refName(baseField), base: expression.num ?? (expression.op === 'log2' ? 2 : 10) } };
                    break;
                default:
                    return false;
            }
            computedDefs.set(field.name, def);
            return true;
        } finally {
            emitting.delete(field.fid);
        }
    };

    const emitRef = (field: IViewField): TerseFieldRef | null => {
        if (SYNTHETIC_FIDS.has(field.fid)) {
            onWarn(`Field '${field.name}' (${field.fid}) is a synthetic field and cannot be expressed in a terse spec; skipped.`);
            return null;
        }
        let name: string;
        if (field.fid === COUNT_FIELD_ID) {
            name = 'count()';
        } else {
            if (field.computed || field.expression) {
                if (field.expression && (field.expression.op === 'dateTimeDrill' || field.expression.op === 'dateTimeFeature')) {
                    const baseParam = field.expression.params.find((p) => p.type === 'field');
                    const level = field.expression.params.find((p) => p.type === 'value');
                    const baseField = baseParam ? poolByFid.get(baseParam.value as string) : undefined;
                    if (field.expression.op === 'dateTimeDrill' && baseField && level && emitComputed(baseField)) {
                        const drillAgg = field.aggName !== 'sum' ? asShorthandAgg(field.aggName) : undefined;
                        // Round-trips through expandTerse's drill expansion with identical query semantics.
                        return {
                            field: refName(baseField),
                            timeUnit: level.value,
                            ...(drillAgg ? { aggregate: drillAgg } : {}),
                            ...(field.sort && field.sort !== 'none' ? { sort: field.sort } : {}),
                        };
                    }
                    onWarn(`Computed field '${field.name}' (${field.expression.op}) cannot be expressed in a terse spec; skipped.`);
                    return null;
                }
                if (!emitComputed(field)) {
                    onWarn(`Computed field '${field.name}' (${field.expression?.op}) cannot be expressed in a terse spec; skipped.`);
                    return null;
                }
            }
            name = refName(field);
        }
        // A timeUnit without a drill expression is display-only formatting; terse timeUnit
        // means a query-level drill, so emitting it would change computed data. Drop + warn.
        if (field.timeUnit && !field.expression) {
            onWarn(`Display-only timeUnit '${field.timeUnit}' on '${field.name}' cannot be expressed in a terse spec; dropped from the projection.`);
        }
        const needsObject = field.sort && field.sort !== 'none';
        const aggregate = asShorthandAgg(field.aggName);
        if (needsObject) {
            return {
                field: name,
                ...(aggregate ? { aggregate } : {}),
                sort: field.sort as 'ascending' | 'descending',
            };
        }
        if (field.fid === COUNT_FIELD_ID) return 'count()';
        if (aggregate) {
            if (field.analyticType !== 'measure') {
                return { field: name, aggregate };
            }
            const shorthand = `${aggregate}(${name})`;
            const roundtrip = parseShorthand(shorthand);
            if (roundtrip.aggregate === aggregate && roundtrip.field === name) return shorthand;
            return { field: name, aggregate };
        }
        return name;
    };

    // Stamped so the projected spec always routes back to the terse branch in
    // detectSpecKind, whatever channels it happens to use.
    const spec: TerseSpec = { $schema: TerseSpecSchemaUrl };
    if (chart.name && chart.name !== 'Chart') spec.name = chart.name;
    if (chart.config.geoms[0] && chart.config.geoms[0] !== 'auto') spec.mark = chart.config.geoms[0];

    for (const [terseKey, channel] of PROJECT_CHANNEL_ENTRIES) {
        const fields = chart.encodings[channel];
        if (!fields || fields.length === 0) continue;
        const refs = fields.map(emitRef).filter((r): r is TerseFieldRef => r !== null);
        if (refs.length === 0) continue;
        if (terseKey === 'x' || terseKey === 'y' || terseKey === 'details') {
            spec[terseKey] = refs.length === 1 ? refs[0] : refs;
        } else {
            if (refs.length > 1) onWarn(`Channel '${channel}' has ${refs.length} fields; only the first is kept in the terse spec.`);
            spec[terseKey] = refs[0];
        }
    }

    if (chart.encodings.filters.length > 0) {
        const filters: TerseFilter[] = [];
        for (const filter of chart.encodings.filters) {
            if (!filter.rule) continue;
            if (filter.computed || filter.expression) emitComputed(filter);
            const field = refName(filter);
            switch (filter.rule.type) {
                case 'one of':
                    filters.push({ field, oneOf: [...filter.rule.value] });
                    break;
                case 'not in':
                    filters.push({ field, notIn: [...filter.rule.value] });
                    break;
                case 'range':
                    filters.push({ field, range: [...filter.rule.value] as [number | null, number | null] });
                    break;
                case 'temporal range':
                    filters.push({ field, timeRange: [...filter.rule.value] as [number | null, number | null] });
                    break;
                default:
                    onWarn(`Filter on '${filter.name}' (${(filter.rule as { type: string }).type}) cannot be expressed in a terse spec; skipped.`);
            }
        }
        if (filters.length > 0) spec.filters = filters;
    }

    if (computedDefs.size > 0) spec.computed = [...computedDefs.values()];
    if (chart.config.defaultAggregated === false) spec.aggregate = false;
    if (chart.layout.stack !== emptyVisualLayout.stack) spec.stack = chart.layout.stack;
    if (chart.config.limit !== emptyVisualConfig.limit) spec.limit = chart.config.limit;

    const configRest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(chart.config)) {
        if (key === 'geoms' || key === 'defaultAggregated' || key === 'limit' || key === '$schema') continue;
        const defaultValue = (emptyVisualConfig as unknown as Record<string, unknown>)[key];
        if (value !== undefined && JSON.stringify(value) !== JSON.stringify(defaultValue)) configRest[key] = value;
    }
    if (Object.keys(configRest).length > 0) spec.config = configRest;

    const layoutRest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(chart.layout)) {
        if (key === 'stack') continue;
        const defaultValue = (emptyVisualLayout as unknown as Record<string, unknown>)[key];
        if (value !== undefined && JSON.stringify(value) !== JSON.stringify(defaultValue)) layoutRest[key] = value;
    }
    if (Object.keys(layoutRest).length > 0) spec.layout = layoutRest;

    return spec;
}
