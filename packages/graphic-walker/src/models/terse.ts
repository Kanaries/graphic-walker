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
} from '../interfaces';
import { newChart } from './visSpecHistory';
import { getSQLItemAnalyticType, parseSQLExpr } from '../lib/sql';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID } from '../constants';
import { emptyVisualConfig, emptyVisualLayout } from '../utils/save';

type OnWarn = (message: string) => void;

// Shorthand aggregates: IAggregator minus 'expr' (aggregate expressions have no
// sensible shorthand syntax and must go through inline computed fields).
const SHORTHAND_AGGS = new Set<IAggregator>(['sum', 'count', 'max', 'min', 'mean', 'median', 'variance', 'stdev', 'distinctCount']);

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

function resolveRef(ref: TerseFieldRef, index: FieldIndex, onWarn: OnWarn): IViewField {
    let base: IViewField;
    let overrides: { aggregate?: IAggregator; sort?: 'ascending' | 'descending' | 'none'; timeUnit?: IViewField['timeUnit'] } = {};
    if (typeof ref === 'string') {
        const shorthand = parseShorthand(ref);
        if (shorthand.aggregate && shorthand.field === '') {
            if (shorthand.aggregate !== 'count') {
                throw new Error(`Aggregate shorthand '${ref}' needs a field, e.g. '${shorthand.aggregate}(Sales)'.`);
            }
            base = index.resolve(`fid:${COUNT_FIELD_ID}`, onWarn);
        } else if (shorthand.aggregate) {
            // A field whose literal name is the whole string wins over the shorthand reading.
            try {
                base = index.resolve(ref, () => void 0);
                onWarn(`'${ref}' resolved to a field literally named '${ref}', not as ${shorthand.aggregate}(${shorthand.field}).`);
            } catch {
                base = index.resolve(shorthand.field, onWarn);
                overrides.aggregate = shorthand.aggregate;
            }
        } else {
            base = index.resolve(ref, onWarn);
        }
    } else {
        base = index.resolve(ref.field, onWarn);
        overrides = { aggregate: ref.aggregate, sort: ref.sort, timeUnit: ref.timeUnit };
    }
    const field: IViewField = { ...base };
    if (overrides.aggregate) {
        if (field.analyticType === 'dimension') {
            onWarn(`Aggregate '${overrides.aggregate}' on dimension '${field.name}' follows existing semantics (ignored unless the field acts as a measure).`);
        }
        field.aggName = overrides.aggregate;
    }
    if (overrides.sort) field.sort = overrides.sort;
    if (overrides.timeUnit) field.timeUnit = overrides.timeUnit;
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

    const encodings: Partial<DraggableFieldState> = {
        dimensions: base.encodings.dimensions.concat(computedFields.filter((f) => f.analyticType === 'dimension')),
        measures: base.encodings.measures.concat(computedFields.filter((f) => f.analyticType === 'measure')),
    };

    for (const key of TERSE_CHANNEL_KEYS) {
        const value = spec[key];
        if (value === undefined) continue;
        const refs = Array.isArray(value) ? value : [value];
        encodings[CHANNEL_MAP[key]] = refs.map((ref) => resolveRef(ref, index, onWarn));
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

    const emitComputed = (field: IViewField): boolean => {
        const expression = field.expression;
        if (!expression) return true;
        if (field.fid === COUNT_FIELD_ID) return true;
        const baseParam = expression.params.find((p) => p.type === 'field');
        const baseField = baseParam ? poolByFid.get(baseParam.value as string) : undefined;
        let def: TerseComputedField;
        switch (expression.op) {
            case 'expr': {
                const sql = expression.params.find((p) => p.type === 'sql');
                if (!sql) return false;
                def = { name: field.name, expr: sql.value as string, analyticType: field.analyticType };
                break;
            }
            case 'bin':
                if (!baseField) return false;
                def = { name: field.name, bin: { field: refName(baseField), count: expression.num ?? 10 } };
                break;
            case 'log':
            case 'log2':
            case 'log10':
                if (!baseField) return false;
                def = { name: field.name, log: { field: refName(baseField), base: expression.num ?? (expression.op === 'log2' ? 2 : 10) } };
                break;
            default:
                return false;
        }
        if (!computedDefs.has(field.name)) {
            computedDefs.set(field.name, def);
        }
        return true;
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
                    if (field.expression.op === 'dateTimeDrill' && baseField && level) {
                        return { field: refName(baseField), timeUnit: level.value, ...(field.sort && field.sort !== 'none' ? { sort: field.sort } : {}) };
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
        const needsObject = (field.sort && field.sort !== 'none') || field.timeUnit;
        const aggregate = field.analyticType === 'measure' && field.aggName && SHORTHAND_AGGS.has(field.aggName as IAggregator);
        if (needsObject) {
            return {
                field: name,
                ...(aggregate ? { aggregate: field.aggName as IAggregator } : {}),
                ...(field.sort && field.sort !== 'none' ? { sort: field.sort } : {}),
                ...(field.timeUnit ? { timeUnit: field.timeUnit } : {}),
            };
        }
        if (field.fid === COUNT_FIELD_ID) return 'count()';
        if (aggregate) {
            const shorthand = `${field.aggName}(${name})`;
            const roundtrip = parseShorthand(shorthand);
            if (roundtrip.aggregate === field.aggName && roundtrip.field === name) return shorthand;
            return { field: name, aggregate: field.aggName as IAggregator };
        }
        return name;
    };

    const spec: TerseSpec = {};
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
    if (chart.config.limit > 0) spec.limit = chart.config.limit;

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
