import type { IFilterField, IViewField, IVisualLayout, IConfigScale } from '../interfaces';
import { MEA_KEY_ID, MEA_VAL_ID } from '../constants';

export interface VegaLiteImportDiagnostic {
    readonly code: 'unsupported-vega-lite';
    readonly configRef: string;
    readonly message: string;
    readonly severity: 'error';
}
export class VegaLiteImportError extends Error {
    readonly code = 'unsupported-vega-lite';
    constructor(readonly diagnostics: readonly VegaLiteImportDiagnostic[]) {
        super(diagnostics.map((item) => `${item.configRef}: ${item.message}`).join('\n'));
        this.name = 'VegaLiteImportError';
    }
}
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const primitive = (value: unknown) =>
    value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const aggregates = new Set(['sum', 'count', 'max', 'min', 'mean', 'median', 'variance', 'stdev']);
const marks = new Set(['bar', 'point', 'circle', 'line', 'area', 'rect', 'text', 'tick', 'arc', 'boxplot', 'interval', 'heatmap']);
const channels = new Set(['x', 'y', 'row', 'column', 'facet', 'color', 'opacity', 'shape', 'size', 'detail', 'details', 'text', 'theta', 'radius', 'order']);
const scaleChannels = { x: 'column', y: 'row', color: 'color', opacity: 'opacity', size: 'size', theta: 'theta', radius: 'radius' } as const;

/** Validate before conversion. This list describes persistent IChart conversion,
 * independently of the larger static RenderPlan axis/style/channel capabilities. */
export function prepareVegaLiteImport(input: unknown, fields: readonly IViewField[]) {
    const diagnostics: VegaLiteImportDiagnostic[] = [];
    const reject = (configRef: string, message = 'This property cannot be represented by the canonical Graphic Walker chart.') =>
        diagnostics.push({ code: 'unsupported-vega-lite', configRef, message, severity: 'error' });
    const keys = (value: Record<string, unknown>, allowed: readonly string[], path: string) => {
        for (const key of Object.keys(value)) if (!allowed.includes(key)) reject(`${path}${path ? '.' : ''}${key}`);
    };
    if (!object(input))
        throw new VegaLiteImportError([{ code: 'unsupported-vega-lite', configRef: '$', message: 'Expected a Vega-Lite-like object.', severity: 'error' }]);
    keys(input, ['$schema', 'title', 'mark', 'encoding', 'facet', 'spec', 'transform', 'width', 'height', 'background', 'config', 'resolve'], '');
    if (input.title !== undefined && typeof input.title !== 'string') reject('title', 'Only a plain chart title is supported.');
    const layout: Partial<IVisualLayout> = {},
        filters: IFilterField[] = [];
    const dict = new Map<string, IViewField>();
    for (const field of fields) if (typeof field.name === 'string') dict.set(field.name, field);
    for (const field of fields) dict.set(field.fid, field);
    const resolve = (reference: unknown, path: string): IViewField | undefined => {
        if (typeof reference !== 'string') {
            reject(path, 'A field reference must name a dataset field.');
            return;
        }
        const exact = fields.find((field) => field.fid === reference);
        const named = fields.filter((field) => field.name === reference);
        const field = exact ?? (named.length === 1 ? named[0] : undefined) ?? (named.length === 0 ? dict.get(reference) : undefined);
        if (!field) reject(path, named.length > 1 ? 'The field name is ambiguous; use its fid.' : 'The referenced dataset field is missing.');
        return field;
    };
    const appendFilter = (predicate: unknown, path: string) => {
        if (!object(predicate)) {
            reject(path, 'Only a field predicate or a supported literal comparison is accepted.');
            return;
        }
        keys(predicate, ['field', 'equal', 'oneOf', 'range', 'gte', 'lte', 'notIn'], path);
        const field = resolve(predicate.field, `${path}.field`);
        const operators = ['equal', 'oneOf', 'range', 'gte', 'lte', 'notIn'].filter((key) => key in predicate);
        if (operators.length !== 1) {
            reject(path, 'A filter must contain exactly one supported predicate.');
            return;
        }
        const op = operators[0],
            value = predicate[op];
        if (
            (op === 'equal' && !primitive(value)) ||
            (['oneOf', 'notIn'].includes(op) && (!Array.isArray(value) || !value.every(primitive))) ||
            (op === 'range' &&
                (!Array.isArray(value) ||
                    value.length !== 2 ||
                    !value.every((item) => item === null || (typeof item === 'number' && Number.isFinite(item))) ||
                    (value[0] !== null && value[1] !== null && value[0] > value[1]))) ||
            (['gte', 'lte'].includes(op) && (typeof value !== 'number' || !Number.isFinite(value)))
        ) {
            reject(`${path}.${op}`, 'The filter values are invalid for this predicate.');
            return;
        }
        const membership = op === 'equal' ? [value] : op === 'oneOf' || op === 'notIn' ? value : [];
        if (
            membership.some((item: unknown) => {
                if (item === null) return true;
                if (typeof item !== 'string') return false;
                try {
                    return typeof JSON.parse(item) === 'object';
                } catch {
                    return false;
                }
            })
        ) {
            reject(
                `${path}.${op}`,
                'Null and JSON-object-like membership values can collide in the existing GW filter encoding and cannot be imported faithfully.',
            );
            return;
        }
        if (!field) return;
        filters.push({
            ...field,
            rule:
                op === 'equal'
                    ? { type: 'one of', value: [value] }
                    : op === 'oneOf'
                      ? { type: 'one of', value }
                      : op === 'notIn'
                        ? { type: 'not in', value }
                        : { type: 'range', value: op === 'gte' ? [value, null] : op === 'lte' ? [null, value] : value },
        });
    };
    const expressionFilter = (expression: string, path: string) => {
        // This is a bounded literal grammar, not an expression evaluator. Consume
        // the entire input so functions, arithmetic, OR and trailing code cannot vanish.
        const comparison =
            /^\s*datum(?:\.([A-Za-z_$][\w$]*)|\[\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\])\s*(===|!==|==|!=|>=|<=)\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)\s*/;
        const literal = (token: string) => (token.startsWith("'") ? token.slice(1, -1).replace(/\\(['\\])/g, '$1') : JSON.parse(token));
        let remaining = expression;
        while (remaining) {
            const match = comparison.exec(remaining);
            if (!match) {
                reject(path, 'Only literal datum comparisons joined with && can be converted; arbitrary expressions and OR are unsupported.');
                return;
            }
            if (match[3] === '==' || match[3] === '!=') {
                reject(path, 'Coercing equality cannot be represented by the existing typed GW membership filters; use a supported strict comparison.');
                return;
            }
            try {
                if ((match[2]?.startsWith("'") && /\\[^'\\]/.test(match[2])) || (match[4].startsWith("'") && /\\[^'\\]/.test(match[4])))
                    throw new Error('escape');
                const field = match[1] ?? literal(match[2]),
                    value = literal(match[4]);
                appendFilter(
                    {
                        field,
                        [match[3] === '>=' ? 'gte' : match[3] === '<=' ? 'lte' : match[3].startsWith('!') ? 'notIn' : 'equal']: match[3].startsWith('!')
                            ? [value]
                            : value,
                    },
                    path,
                );
            } catch {
                reject(path, 'The filter literal is not supported.');
                return;
            }
            remaining = remaining.slice(match[0].length);
            if (!remaining) return;
            if (!remaining.startsWith('&&') || !remaining.slice(2).trim()) {
                reject(path, 'Only conjunctions of complete literal comparisons are supported.');
                return;
            }
            remaining = remaining.slice(2);
        }
        if (!expression.trim()) reject(path, 'A filter expression cannot be empty.');
    };
    let folds: string[] | undefined;
    if (input.transform !== undefined && !Array.isArray(input.transform)) reject('transform', 'Transforms must be an array.');
    for (const [index, transform] of (Array.isArray(input.transform) ? input.transform : []).entries()) {
        const path = `transform[${index}]`;
        if (!object(transform)) {
            reject(path);
            continue;
        }
        if ('filter' in transform) {
            keys(transform, ['filter'], path);
            if (folds) reject(path, 'A filter after fold cannot be moved before the existing GW fold operation.');
            if (typeof transform.filter === 'string') expressionFilter(transform.filter, `${path}.filter`);
            else appendFilter(transform.filter, `${path}.filter`);
        } else if ('fold' in transform) {
            keys(transform, ['fold', 'as'], path);
            if (folds) reject(path, 'Only one fold operation is supported.');
            if (!Array.isArray(transform.fold) || !transform.fold.length) {
                reject(`${path}.fold`);
                continue;
            }
            const members = transform.fold.map((ref: unknown, index: number) => resolve(ref, `${path}.fold[${index}]`));
            if (members.some((field: IViewField | undefined) => field && field.analyticType !== 'measure'))
                reject(`${path}.fold`, 'The existing GW fold operation requires measure fields.');
            folds = members.filter((field): field is IViewField => field !== undefined).map((field) => field.fid);
            if (new Set(folds).size !== folds.length) reject(`${path}.fold`, 'Fold fields must be unique.');
            const aliases = transform.as ?? ['key', 'value'];
            if (!Array.isArray(aliases) || aliases.length !== 2 || aliases.some((alias) => typeof alias !== 'string' || !alias) || aliases[0] === aliases[1]) {
                reject(`${path}.as`);
                continue;
            }
            for (const [position, fid] of [MEA_KEY_ID, MEA_VAL_ID].entries()) {
                if (dict.has(aliases[position])) reject(`${path}.as[${position}]`, 'A fold output would overwrite an existing field.');
                const field = fields.find((field) => field.fid === fid);
                if (field) dict.set(aliases[position], field);
            }
        } else reject(path, 'Only the existing filter and fold transforms can be converted; calculated/window/aggregate transforms are not executed here.');
    }
    if (input.background !== undefined) {
        if (typeof input.background === 'string') layout.background = input.background;
        else reject('background');
    }
    if (input.width !== undefined || input.height !== undefined) {
        if (![input.width, input.height].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0))
            reject('width/height', 'Fixed sizing requires both positive width and height.');
        else layout.size = { mode: 'fixed', width: input.width, height: input.height };
    }
    const format = (kind: 'numberFormat' | 'timeFormat', value: unknown, path: string) => {
        if (typeof value !== 'string') {
            reject(path, 'Format must be a static string.');
            return;
        }
        if (layout.format?.[kind] !== undefined && layout.format[kind] !== value)
            reject(path, 'Different formats of the same value type cannot share the canonical global format.');
        layout.format = { ...layout.format, [kind]: value };
    };
    if (input.config !== undefined) {
        if (!object(input.config)) reject('config');
        else {
            keys(input.config, ['numberFormat', 'timeFormat'], 'config');
            for (const key of ['numberFormat', 'timeFormat'] as const) if (input.config[key] !== undefined) format(key, input.config[key], `config.${key}`);
        }
    }
    if (input.resolve !== undefined) {
        if (!object(input.resolve) || !object(input.resolve.scale)) reject('resolve');
        else {
            keys(input.resolve, ['scale'], 'resolve');
            keys(input.resolve.scale, ['x', 'y', 'color', 'opacity', 'shape', 'size'], 'resolve.scale');
            layout.resolve = {};
            for (const [key, value] of Object.entries(input.resolve.scale)) {
                if (value !== 'shared' && value !== 'independent') reject(`resolve.scale.${key}`);
                else layout.resolve[key] = value === 'independent';
            }
        }
    }
    const view = input.spec ?? input;
    if (!object(view)) reject('spec');
    else if (input.spec) {
        keys(view, ['mark', 'encoding'], 'spec');
        if (!input.facet) reject('spec', 'A nested view requires a supported row/column facet.');
        if (input.mark || input.encoding) reject('spec', 'A nested view cannot also have an outer mark or encoding.');
    }
    const mark = object(view) ? view.mark : undefined,
        markType = typeof mark === 'string' ? mark : object(mark) ? mark.type : undefined;
    if (!marks.has(markType)) reject(input.spec ? 'spec.mark' : 'mark', 'The mark cannot be mapped to an existing GW geometry.');
    if (object(mark)) {
        keys(mark, ['type', 'color'], input.spec ? 'spec.mark' : 'mark');
        if (mark.color !== undefined) {
            if (typeof mark.color === 'string') layout.primaryColor = mark.color;
            else reject('mark.color');
        }
    }
    const definitions: Array<{ channel: string; value: unknown; path: string }> = [];
    if (input.facet !== undefined) {
        if (!object(input.facet)) reject('facet');
        else {
            keys(input.facet, ['row', 'column'], 'facet');
            for (const [channel, value] of Object.entries(input.facet)) definitions.push({ channel, value, path: `facet.${channel}` });
        }
    }
    if (object(view) && view.encoding !== undefined) {
        if (!object(view.encoding)) reject(input.spec ? 'spec.encoding' : 'encoding');
        else
            for (const [channel, value] of Object.entries(view.encoding))
                definitions.push({ channel, value, path: `${input.spec ? 'spec.' : ''}encoding.${channel}` });
    }
    const zeros: Array<{ channel: string; value: boolean; path: string }> = [],
        quantitativeAxes: string[] = [];
    const stacks = new Set<unknown>();
    for (const definition of definitions) {
        const { channel, path } = definition;
        if (!channels.has(channel)) {
            reject(path, 'This encoding channel cannot be persisted in IChart.');
            continue;
        }
        const values = Array.isArray(definition.value) && ['detail', 'details'].includes(channel) ? definition.value : [definition.value];
        for (const [index, value] of values.entries()) {
            const at = values.length > 1 ? `${path}[${index}]` : path;
            if (!object(value)) {
                reject(at, 'An encoding requires a field definition.');
                continue;
            }
            keys(value, channel === 'order' ? ['sort'] : ['field', 'type', 'aggregate', 'bin', 'sort', 'stack', 'scale', 'axis'], at);
            if (channel === 'order') {
                reject(at, 'An explicit Vega-Lite order channel cannot be represented by the existing GW measure-sort setting.');
                continue;
            }
            const field =
                value.field === undefined && value.aggregate === 'count'
                    ? fields.find((field) => field.fid === 'gw_count_fid')
                    : resolve(value.field, `${at}.field`);
            if (value.type !== undefined && !['quantitative', 'nominal', 'ordinal', 'temporal'].includes(value.type)) reject(`${at}.type`);
            if (value.aggregate !== undefined && (!aggregates.has(value.aggregate) || ['row', 'column', 'facet', 'detail', 'details'].includes(channel)))
                reject(`${at}.aggregate`);
            if (value.bin !== undefined && typeof value.bin !== 'boolean')
                reject(`${at}.bin`, 'Only the existing default GW bin conversion is supported; bin parameters cannot be silently ignored.');
            if (value.bin && (field?.fid === MEA_KEY_ID || field?.fid === MEA_VAL_ID)) {
                reject(`${at}.bin`, 'Fold output values do not exist when the current GW workflow evaluates computed bins.');
            }
            if (value.bin && value.aggregate) reject(`${at}.bin`, 'Binning and aggregation on the same binding require an explicit prepared field.');
            if (value.sort !== undefined)
                reject(`${at}.sort`, 'Vega-Lite member/domain ordering is not the same as GW measure-driven sort; this input path cannot preserve that order.');
            if (value.stack !== undefined) {
                if (![null, true, 'zero', 'normalize', 'center'].includes(value.stack)) reject(`${at}.stack`);
                stacks.add(value.stack === true ? 'zero' : value.stack);
            }
            const semanticType = value.type ?? field?.semanticType;
            if (['x', 'y'].includes(channel) && semanticType === 'quantitative') quantitativeAxes.push(channel);
            if (value.axis !== undefined) {
                if (!['x', 'y'].includes(channel) || !object(value.axis))
                    reject(`${at}.axis`, 'Hidden and non-position axes cannot be persisted by this input path.');
                else {
                    keys(value.axis, ['format'], `${at}.axis`);
                    if (value.axis.format !== undefined) {
                        if (!['quantitative', 'temporal'].includes(semanticType))
                            reject(`${at}.axis.format`, 'Only numeric and temporal formats map to canonical formatting.');
                        else format(semanticType === 'temporal' ? 'timeFormat' : 'numberFormat', value.axis.format, `${at}.axis.format`);
                    }
                }
            }
            if (value.scale !== undefined) {
                const mapped = scaleChannels[channel as keyof typeof scaleChannels];
                if (!mapped || !object(value.scale)) {
                    reject(`${at}.scale`);
                    continue;
                }
                keys(value.scale, ['type', 'domain', 'range', 'zero'], `${at}.scale`);
                if (Object.keys(value.scale).length && semanticType !== 'quantitative')
                    reject(`${at}.scale`, 'Only quantitative scale endpoints and types map to the canonical scale fields.');
                const scale: IConfigScale = {};
                if (value.scale.type !== undefined) {
                    if (!['linear', 'log', 'pow', 'sqrt', 'symlog'].includes(value.scale.type)) reject(`${at}.scale.type`);
                    else scale.type = value.scale.type;
                }
                for (const part of ['domain', 'range'] as const)
                    if (value.scale[part] !== undefined) {
                        const endpoints = value.scale[part];
                        if (
                            !Array.isArray(endpoints) ||
                            endpoints.length !== 2 ||
                            endpoints.some((endpoint) => typeof endpoint !== 'number' || !Number.isFinite(endpoint)) ||
                            (part === 'domain' && endpoints[0] > endpoints[1])
                        )
                            reject(`${at}.scale.${part}`, 'Only a numeric endpoint pair maps to the existing scale fields.');
                        else {
                            scale[`${part}Min`] = endpoints[0];
                            scale[`${part}Max`] = endpoints[1];
                        }
                    }
                if (value.scale.zero !== undefined) {
                    if (!['x', 'y'].includes(channel) || typeof value.scale.zero !== 'boolean') reject(`${at}.scale.zero`);
                    else zeros.push({ channel, value: value.scale.zero, path: `${at}.scale.zero` });
                }
                layout.scale = { ...layout.scale, [mapped]: scale };
            }
        }
    }
    if (stacks.size > 1) reject('encoding', 'Conflicting stacks cannot share the canonical chart stack setting.');
    if (zeros.length) {
        const settings = quantitativeAxes.map((channel) => zeros.find((item) => item.channel === channel)?.value ?? true);
        if (new Set(settings).size > 1)
            reject(zeros[0].path, 'The canonical zeroScale option is shared by numeric position axes; conflicting values cannot be imported.');
        else layout.zeroScale = zeros[0].value;
    }
    if (diagnostics.length) throw new VegaLiteImportError(diagnostics);
    return { fields: dict, filters, folds, layout };
}
