import { toVegaSpec } from '@/lib/vega';
import { Methods, PropsMap, VisActionOf, VisSpecWithHistory, reducer } from './visSpecHistory';
import type { IAggregator, IChart, IChatMessage, IFilterField, IViewField } from '@/interfaces';
import { GLOBAL_CONFIG } from '@/config';
import { autoMark } from '@/vis/spec/mark';
import { viewEncodingKeys } from './visSpec';
import { MEA_KEY_ID, MEA_VAL_ID } from '@/constants';

function transformFilter(filter: IFilterField) {
    if (!filter.rule) {
        return null;
    }
    switch (filter.rule.type) {
        case 'range':
        case 'temporal range': {
            const expressions: string[] = [];
            if (filter.rule.value[0] !== undefined && filter.rule.value[0] !== null) {
                expressions.push(`datum['${filter.name}'] >= ${JSON.stringify(filter.rule.value[0])}`);
            }
            if (filter.rule.value[1] !== undefined && filter.rule.value[1] !== null) {
                expressions.push(`datum['${filter.name}'] <= ${JSON.stringify(filter.rule.value[1])}`);
            }
            return expressions.join('&&');
        }
        case 'one of':
            return filter.rule.value.map((v) => `datum['${filter.name}'] == ${JSON.stringify(v)}`).join('||');
        case 'not in':
            return filter.rule.value.map((v) => `datum['${filter.name}'] != ${JSON.stringify(v)}`).join('&&');
    }
}

export function toVegaSimplified(chart: IChart) {
    const { defaultAggregated, geoms, folds } = chart.config;
    const { stack } = chart.layout;
    const { rows, columns, color, details, opacity, radius, shape, size, text, theta, filters, dimensions, measures } = chart.encodings;

    const fieldNames = new Map(dimensions.concat(measures).map((f) => [f.fid, f.name]));

    const viewEncodingFields = viewEncodingKeys(geoms[0] ?? 'auto').flatMap<IViewField>((k) => chart.encodings?.[k] ?? []);

    const viewDimensions = viewEncodingFields.filter((x) => x.analyticType === 'dimension');
    const viewMeasures = viewEncodingFields.filter((x) => x.analyticType === 'measure');

    const hasFold = viewDimensions.find((x) => x.fid === MEA_KEY_ID) && viewMeasures.find((x) => x.fid === MEA_VAL_ID);

    const guardedRows = rows.filter((x) => defaultAggregated || x.aggName !== 'expr');
    const guardedCols = columns.filter((x) => defaultAggregated || x.aggName !== 'expr');

    const specs = toVegaSpec({
        rows: guardedRows,
        columns: guardedCols,
        defaultAggregated,
        layoutMode: 'auto',
        dataSource: [],
        geomType: geoms[0],
        height: 0,
        width: 0,
        interactiveScale: false,
        mediaTheme: 'light',
        stack: stack,
        vegaConfig: {},
        color: color[0],
        details,
        opacity: opacity[0],
        radius: radius[0],
        shape: shape[0],
        size: size[0],
        text: text[0],
        theta: theta[0],
    }).map((spec) => {
        const newSpec = { ...spec };
        if (newSpec['data']) delete newSpec['data'];
        if (newSpec['resolve']) delete newSpec['resolve'];
        if (newSpec['params']) delete newSpec['params'];
        if (newSpec['encoding']?.['tooltip']) delete newSpec['encoding']['tooltip'];
        if (newSpec['encoding']) {
            newSpec['encoding'] = Object.fromEntries(
                Object.entries(newSpec.encoding).map(([k, field]: [string, any]) => {
                    return [
                        k,
                        {
                            field: field.title,
                            type: field.type,
                        },
                    ];
                })
            );
        }

        if (newSpec['mark']) {
            newSpec['mark'] = newSpec['mark'].type;
        }
        if (hasFold && folds) {
            if (!newSpec.transform) {
                newSpec.transform = [];
            }
            newSpec.transform.push({
                fold: folds.map((fid) => fieldNames.get(fid) ?? fid),
            });
        }
        if (filters.length > 0) {
            if (!newSpec.transform) {
                newSpec.transform = [];
            }
            newSpec.transform.push(...filters.map(transformFilter).map((filter) => ({ filter })));
        }
        return newSpec;
    });
    if (specs.length === 1) {
        return specs[0];
    }
    const concat = specs.map((spec) => {
        const { transform, config, ...rest } = spec;
        return rest;
    });
    return {
        ...(specs[0].transform ? { transform: specs[0].transform } : {}),
        concat,
    };
}

const aggNameMap: Record<IAggregator, string> = {
    count: 'count',
    sum: 'sum',
    max: 'max',
    min: 'min',
    mean: 'mean',
    median: 'median',
    variance: 'variance',
    stdev: 'stdev',
    distinctCount: 'distinct',
    expr: '', // computed expression aggregations already encode their logic
};

export function toVegaSimplifiedWithAggergation(chart: IChart) {
    const simplifiedSpec = toVegaSimplified(chart);
    const shouldAnnotateAggregate = Boolean(chart.config.defaultAggregated);
    const ROW_COUNT_FID = 'gw_count_fid';

    type FieldMeta = {
        title: string;
        field: string;
        aggregate?: string;
    };

    const fieldMetaMap = new Map<string, FieldMeta>();

    const getFieldTitle = (field: IViewField): string => {
        const fieldLabel = field.name ?? field.fid;
        if (field.fid === ROW_COUNT_FID) {
            return 'Count';
        }
        if (field.analyticType === 'measure' && field.aggName && field.aggName !== 'expr') {
            return `${field.aggName}(${fieldLabel})`;
        }
        return fieldLabel;
    };

    const registerField = (field?: IViewField) => {
        if (!field) return;
        const title = getFieldTitle(field);
        if (!title) {
            return;
        }
        const aggName = shouldAnnotateAggregate ? (field.aggName as IAggregator | undefined) : undefined;
        const aggregate = aggName ? aggNameMap[aggName] : undefined;
        const normalizedAggregate = aggregate && aggregate.length > 0 ? aggregate : undefined;
        const nextMeta: FieldMeta = {
            title,
            field: field.basename ?? field.name ?? field.fid,
            aggregate: normalizedAggregate,
        };
        const existingMeta = fieldMetaMap.get(title);
        if (!existingMeta || (!existingMeta.aggregate && normalizedAggregate)) {
            fieldMetaMap.set(title, nextMeta);
        }
    };

    Object.values(chart.encodings).forEach((fields) => {
        if (Array.isArray(fields)) {
            fields.forEach((field) => registerField(field as IViewField));
        }
    });

    const enhanceFieldDef = (fieldDef: any) => {
        if (!fieldDef || typeof fieldDef !== 'object') {
            return fieldDef;
        }
        const labelKey = typeof fieldDef.field === 'string' ? fieldDef.field : undefined;
        if (!labelKey) {
            return fieldDef;
        }
        const meta = fieldMetaMap.get(labelKey);
        if (!meta) {
            return fieldDef;
        }
        const next: Record<string, any> = { ...fieldDef, field: meta.field, title: meta.title };
        if (meta.aggregate) {
            next.aggregate = meta.aggregate;
        } else if ('aggregate' in next) {
            delete next.aggregate;
        }
        return next;
    };

    const visitSpec = (spec: any) => {
        if (!spec || typeof spec !== 'object') {
            return;
        }
        if (spec.encoding) {
            spec.encoding = Object.fromEntries(
                Object.entries(spec.encoding).map(([channel, value]) => {
                    if (Array.isArray(value)) {
                        return [channel, value.map((definition) => enhanceFieldDef(definition))];
                    }
                    return [channel, enhanceFieldDef(value)];
                })
            );
        }
        ['layer', 'concat', 'hconcat', 'vconcat'].forEach((key) => {
            if (Array.isArray(spec[key])) {
                spec[key].forEach(visitSpec);
            }
        });
        if (spec.spec) {
            visitSpec(spec.spec);
        }
    };

    visitSpec(simplifiedSpec);
    return simplifiedSpec;
}

const actionMessageMapper: {
    [a in Methods]: (data: IChart, ...a: PropsMap[a]) => string;
} = {
    [Methods.setConfig]: (_data, key, value) => `Set the ${key} config to ${JSON.stringify(value)}.`,
    [Methods.removeField]: (data, encoding, index) => {
        const originalField = data.encodings[encoding][index];
        return `Remove the ${originalField.name} field in ${encoding}.`;
    },
    [Methods.reorderField]: () => ``,
    [Methods.moveField]: (data, from, findex, to) => {
        const originalField = data.encodings[from][findex];
        return `Move the ${originalField.name} field from ${from} to ${to}`;
    },
    [Methods.cloneField]: (data, from, findex, to) => {
        const originalField = data.encodings[from][findex];
        return `Use the ${originalField.name} field for ${to} encoding.`;
    },
    [Methods.createBinlogField]: (data, encoding, index, op, _newVarKey, num) => {
        const originalField = data.encodings[encoding][index];
        const isBin = op.startsWith('bin');
        const prefix = isBin ? `${op}${num}` : `log${num}`;
        return `Create a ${prefix} field for ${originalField.name} field in ${encoding}.`;
    },
    [Methods.appendFilter]: (data, _index, from, findex, _dragId) => {
        const originalField = data.encodings[from][findex];
        return `Create a empty filter for ${originalField.name} field in ${from}.`;
    },
    [Methods.modFilter]: (data, index, from, findex) => {
        const originalField = data.encodings[from][findex];
        const originalFilter = data.encodings.filters[index];
        return `Change the filter of ${originalFilter.name} for ${originalField.name}.`;
    },
    [Methods.writeFilter]: (data, index, rule) => {
        const originalFilter = data.encodings.filters[index];
        return `Change the rule of ${originalFilter.name} field to ${JSON.stringify(rule)}.`;
    },
    [Methods.setName]: (_data, name) => `Change the chart name to ${name}.`,
    [Methods.applySort]: (_data, sort) => `Change sorting to ${sort}.`,
    [Methods.transpose]: () => `Transpose the chart.`,
    [Methods.setLayout]: (_data, kvs) => {
        const stack = kvs.find((x) => x[0] === 'stack' && x[1]);
        if (stack) {
            return `Change the stack to ${stack[1]}.`;
        }
        return '';
    },
    [Methods.setFieldAggregator]: (data, encoding, index, aggName) => {
        const originalField = data.encodings[encoding][index];
        return `Change the aggregator of ${originalField.name} field to ${aggName}.`;
    },
    [Methods.setGeoData]: () => ``,
    [Methods.setCoordSystem]: (_data, system) => `Change the mark to ${GLOBAL_CONFIG.GEOM_TYPES[system][0]}.`,
    [Methods.createDateDrillField]: () => ``,
    [Methods.createDateFeatureField]: () => ``,
    [Methods.changeSemanticType]: () => ``,
    [Methods.setFilterAggregator]: () => ``,
    [Methods.addFoldField]: () => '',
    [Methods.upsertPaintField]: () => '',
    [Methods.addSQLComputedField]: () => '',
    [Methods.removeAllField]: () => '',
    [Methods.editAllField]: () => '',
    [Methods.replaceWithNLPQuery]: () => '',
};

function toMessage<T>(data: IChart, action: VisActionOf<T>) {
    const [type, ...props] = action;
    return actionMessageMapper[type](data, ...props);
}

export function toChatMessage(history: VisSpecWithHistory): IChatMessage[] {
    const result: IChatMessage[] = [];
    let now = history.base;
    let message = '';

    const createGeneratedMessages = () => {
        if (message) {
            if (now.config.geoms[0] === 'auto') {
                message += `\nChange the geom type to ${autoMark(now.encodings.rows.concat(now.encodings.columns).map((x) => x.semanticType))}.`;
            }
            const viewEncodingFields = viewEncodingKeys(now.config.geoms[0] ?? 'auto').flatMap<IViewField>((k) => now.encodings?.[k] ?? []);
            const isEmptyChart = viewEncodingFields.length === 0;
            if (!isEmptyChart) {
                result.push({ role: 'user', content: message, type: 'generated' });
                result.push({ role: 'assistant', chart: now, type: 'generated' });
            }
            message = '';
        }
    };
    for (let i = 0; i < history.cursor; i++) {
        const method = history.timeline[i];
        if (method[0] === Methods.replaceWithNLPQuery) {
            const [_, query, response] = method;
            createGeneratedMessages();
            result.push({ role: 'user', content: query, type: 'normal' });
            result.push({
                role: 'assistant',
                chart: JSON.parse(response),
                type: 'normal',
            });
        } else {
            const actionMessage = toMessage(now, method);
            if (actionMessage) {
                if (!message) {
                    message = actionMessage;
                } else {
                    message += `\n${actionMessage}`;
                }
            }
        }
        now = reducer(now, method);
    }
    createGeneratedMessages();
    return result;
}
