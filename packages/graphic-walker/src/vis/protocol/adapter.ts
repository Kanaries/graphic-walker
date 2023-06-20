import { nanoid } from "nanoid";
import type { DeepReadonly, DraggableFieldState, IVisualConfig, IViewField, IStackMode, ISemanticType, VegaGlobalConfig, IMutField, IFilterField } from "../../interfaces";
import type { IAggregator } from "../../interfaces";
import { autoMark } from "../spec/mark";
import type { IVisEncodingChannel, IVisEncodingChannelRef, IVisEncodings, IVisFieldComputation, IVisFilter, IVisSchema } from "./interface";


interface IGWSpec {
    datasetId: string;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: IVisualConfig;
    vegaConfig?: any;
}

export interface IVegaConfigSchema {
    vegaConfig: VegaGlobalConfig;
    size: IVisualConfig['size'];
    format: IVisualConfig['format'];
    interactiveScale: boolean;
    showActions: boolean;
    zeroScale: boolean;
}

const extractVisEncChannel = (
    enc: DeepReadonly<IViewField>,
    defaultAggregate: boolean,
    sortByField: DeepReadonly<IViewField> | null = null,
    stack: IStackMode = 'none',
): IVisEncodingChannel => {
    const { fid, aggName, analyticType, sort } = enc;
    const channel: IVisEncodingChannel = {
        field: fid,
    };
    if (analyticType === 'measure' && defaultAggregate && aggName) {
        // apply aggregate
        channel.aggregate = aggName as IAggregator;
    }
    if (sort && sort !== 'none' && sortByField) {
        // apply sort
        channel.sort = {
            field: sortByField.fid,
            order: sort === 'ascending' ? 'asc' : 'desc',
        };
    }
    if (analyticType === 'measure' && stack !== 'none') {
        // apply stack
        channel.stack = stack === 'stack' ? 'zero' : 'normalize';
    }
    if (Object.keys(channel).length === 1) {
        return fid;
    } else {
        return channel;
    }
};

const transformGWPositionChannels = (
    encodings: DeepReadonly<DraggableFieldState>,
    defaultAggregate: boolean,
    stack: IStackMode,
): Partial<IVisEncodings> => {
    const enc: Partial<IVisEncodings> = {};

    const { rows, columns } = encodings;

    const rowDims: DeepReadonly<IViewField>[] = [];
    const colDims: DeepReadonly<IViewField>[] = [];
    const rowMeas: DeepReadonly<IViewField>[] = [];
    const colMeas: DeepReadonly<IViewField>[] = [];

    for (const row of rows) {
        if (row.analyticType === 'dimension') {
            rowDims.push(row);
        } else {
            rowMeas.push(row);
        }
    }
    for (const col of columns) {
        if (col.analyticType === 'dimension') {
            colDims.push(col);
        } else {
            colMeas.push(col);
        }
    }

    const rowRepeatFields = rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas;//rowMeas.slice(0, -1);
    const colRepeatFields = colMeas.length === 0 ? colDims.slice(-1) : colMeas;//colMeas.slice(0, -1);

    // handle facets
    const rowLeftFacetFields = rows.slice(0, -1).filter(f => f.analyticType === 'dimension');
    const colLeftFacetFields = columns.slice(0, -1).filter(f => f.analyticType === 'dimension');
    const rowFacetField = rowLeftFacetFields.length > 0 ? rowLeftFacetFields[rowLeftFacetFields.length - 1] : null;
    const colFacetField = colLeftFacetFields.length > 0 ? colLeftFacetFields[colLeftFacetFields.length - 1] : null;

    if (rowFacetField) {
        enc.row = extractVisEncChannel(rowFacetField, defaultAggregate);
    }
    if (colFacetField) {
        enc.column = extractVisEncChannel(colFacetField, defaultAggregate);
    }

    if (rowRepeatFields.length > 1 || colRepeatFields.length > 1) {
        // repeat
        if (rowRepeatFields.length) {
            enc.y = rowRepeatFields.map(f => extractVisEncChannel(f, defaultAggregate, colRepeatFields[0] ?? null, stack));
        }
        if (colRepeatFields.length) {
            enc.x = colRepeatFields.map(f => extractVisEncChannel(f, defaultAggregate, rowRepeatFields[0] ?? null, stack));
        }
    } else {
        // no repeat
        const yField = rows.length > 0 ? rows[rows.length - 1] : null;
        const xField = columns.length > 0 ? columns[columns.length - 1] : null;

        if (yField) {
            enc.y = extractVisEncChannel(yField, defaultAggregate, xField, stack);
        }
        if (xField) {
            enc.x = extractVisEncChannel(xField, defaultAggregate, yField, stack);
        }
    }

    return enc;
};

const nonPositionChannels = ['color', 'opacity', 'size', 'shape', 'theta', 'radius', 'details', 'text'] as const;

export const transformGWSpec2VisSchema = (spec: IGWSpec): IVisSchema<IVegaConfigSchema> => {
    const { datasetId, draggableFieldState, visualConfig, vegaConfig } = spec;
    const { defaultAggregated, geoms, stack, size } = visualConfig;
    const [markType] = geoms;

    const enc = transformGWPositionChannels(draggableFieldState, defaultAggregated, stack);
    for (const channel of nonPositionChannels) {
        const [field] = draggableFieldState[channel];
        if (!field) {
            continue;
        }
        enc[channel] = extractVisEncChannel(field, defaultAggregated);
    }
    if (draggableFieldState.details.length) {
        enc.details = draggableFieldState.details.map(f => extractVisEncChannel(f, defaultAggregated));
    }

    const dsl: IVisSchema<IVegaConfigSchema> = {
        datasetId,
        markType,
        encodings: enc,
        configs: {
            size,
            vegaConfig,
            format: visualConfig.format,
            interactiveScale: visualConfig.interactiveScale,
            showActions: visualConfig.showActions,
            zeroScale: visualConfig.zeroScale,
        },
    };

    if (markType === 'auto') {
        // auto mark
        const types: ISemanticType[] = [];
        const x = Array.isArray(enc.x) ? enc.x[0] : enc.x;
        const xFid = typeof x === 'string' ? x : x?.field;
        const xType = draggableFieldState.columns.find(f => f.fid === xFid)?.semanticType;
        if (xType) {
            types.push(xType);
        }
        const y = Array.isArray(enc.y) ? enc.y[0] : enc.y;
        const yFid = typeof y === 'string' ? y : y?.field;
        const yType = draggableFieldState.rows.find(f => f.fid === yFid)?.semanticType;
        if (yType) {
            types.push(yType);
        }
        dsl.markType = autoMark(types);
    }

    const filters = draggableFieldState.filters.filter(f => f.rule);
    if (filters.length) {
        dsl.filters = filters.map<IVisFilter>(f => {
            const rule = f.rule!;
            if (rule.type === 'one of') {
                return {
                    field: f.fid,
                    type: 'oneOf',
                    value: Array.from(rule.value),
                };
            }
            return {
                field: f.fid,
                type: 'range',
                min: rule.value[0],
                max: rule.value[1],
            };
        });
    }

    if (size.mode === 'fixed') {
        dsl.size = {
            width: size.width,
            height: size.height,
        };
    }

    const allComputedFields = draggableFieldState.dimensions.concat(draggableFieldState.measures).filter(f => f.computed && f.expression).map<IVisFieldComputation>(f => ({
        field: f.fid,
        expression: f.expression!,
        name: f.name,
        type: f.semanticType,
    }));
    const allFieldsInUse = Object.values(dsl.encodings).flat().filter(Boolean).reduce<string[]>((acc, channel) => {
        const fieldKey = typeof channel === 'string' ? channel : channel.field;
        if (!acc.includes(fieldKey)) {
            acc.push(fieldKey);
        }
        return acc;
    }, []);
    const computedFieldsInUse = allComputedFields.filter(f => allFieldsInUse.includes(f.field));
    if (computedFieldsInUse.length) {
        dsl.computations = computedFieldsInUse;
    }
    
    return dsl;
};

// keys share the same name between encodings of IVisSchema and IGWSpec, single field channels
const sharedSglEncKeys = ['color', 'opacity', 'size', 'shape', 'theta', 'radius', 'text'] as const;
// keys share the same name between encodings of IVisSchema and IGWSpec, multiple field channels
const sharedMltEncKeys = ['details'] as const;

const extractDraggableField = (
    field: IVisEncodingChannel,
    defaultAggregate: boolean,
    computations: IVisFieldComputation[] | undefined,
    fields: IMutField[],
    allowSort: boolean,
): IViewField | null => {
    const fieldKey = typeof field === 'string' ? field : field.field;
    const _f = fields.find(f => f.fid === fieldKey);
    const computation = computations?.find(c => c.field === fieldKey);
    const f = computation ?? _f;
    if (!f) {
        return null;
    }
    const aggregation = typeof field === 'string' ? undefined : field.aggregate;
    const sortConfig = typeof field === 'string' ? undefined : field.sort;
    const order = typeof sortConfig === 'string' ? sortConfig : sortConfig?.order;
    const inferredAnalyticType = aggregation ? 'measure' : 'dimension';
    const semanticType = 'type' in f ? f.type : f.semanticType;
    const analyticType = 'type' in f ? inferredAnalyticType : f.analyticType;
    return {
        dragId: nanoid(),
        fid: fieldKey,
        name: f.name ?? fieldKey,
        semanticType: semanticType,
        analyticType: defaultAggregate ? inferredAnalyticType : analyticType,
        computed: Boolean(computation),
        expression: computation?.expression,
        aggName: aggregation,
        sort: allowSort && order ? (
            order === 'asc' ? 'ascending' : 'descending'
        ) : undefined,
    };
};

export const forwardVegaVisSchema = (baseSchema: IVisSchema): IVisSchema<IVegaConfigSchema> => {
    const isVegaVisSchema = baseSchema.configs && 'vegaConfig' in (baseSchema.configs as any);
    if (isVegaVisSchema) {
        return baseSchema as IVisSchema<IVegaConfigSchema>;
    }
    return {
        ...baseSchema,
        configs: {
            vegaConfig: {},
            size: {
                mode: baseSchema.size?.width === 320 && baseSchema.size.height === 200 ? 'auto' : 'fixed',
                width: baseSchema.size?.width ?? 320,
                height: baseSchema.size?.height ?? 200,
            },
            format: {},
            interactiveScale: false,
            showActions: false,
            zeroScale: false,
        },
    };
};

export const transformVisSchema2GWSpec = (dsl: IVisSchema, fields: IMutField[]): IGWSpec => {
    const { datasetId, markType, encodings, configs, filters, computations } = forwardVegaVisSchema(dsl);
    const { size, vegaConfig, format, interactiveScale, showActions, zeroScale } = configs;

    const hasAggregated = Object.values(encodings).flat().some(f => typeof f !== 'string' && f.aggregate);
    const stackMode = (Object.values(encodings).flat() as IVisEncodingChannelRef[]).find(f => typeof f !== 'string' && f.stack)?.stack ?? 'none';

    const visualConfig: IVisualConfig = {
        geoms: [markType],
        defaultAggregated: hasAggregated,
        stack: stackMode === 'normalize' ? 'normalize' : stackMode === 'zero' ? 'stack' : 'none',
        size,
        format,
        interactiveScale,
        showActions,
        zeroScale,
        sorted: 'none',
    };

    const draggableFieldState: DraggableFieldState = {
        columns: [],
        rows: [],
        dimensions: [],
        measures: [],
        filters: [],
        color: [],
        opacity: [],
        size: [],
        shape: [],
        theta: [],
        radius: [],
        details: [],
        text: [],
    };

    const allFields: IViewField[] = [];
    const addField = (field: Omit<IViewField, 'dragId'>) => {
        if (allFields.some(f => f.fid === field.fid)) {
            return;
        }
        const f = { ...field, dragId: nanoid() };
        allFields.push(f);
        draggableFieldState[`${field.analyticType}s`].push(f);
    };

    // extract non-positional channels
    for (const key of sharedSglEncKeys) {
        const field = encodings[key];
        if (!field) {
            continue;
        }
        const res = extractDraggableField(field, hasAggregated, computations, fields, false);
        if (res) {
            draggableFieldState[key] = [res];
            addField(res);
        }
    }
    for (const key of sharedMltEncKeys) {
        const field = encodings[key];
        const fieldArr = Array.isArray(field) ? field : [field!].filter(Boolean);
        if (fieldArr.length === 0) {
            continue;
        }
        draggableFieldState[key] = fieldArr.map(f => extractDraggableField(f, hasAggregated, computations, fields, false)!).filter(Boolean);
        draggableFieldState[key].forEach(addField);
    }

    // extract positional channels
    const hasMltXEnc = Array.isArray(encodings.x) && encodings.x.length > 1;
    const hasMltYEnc = Array.isArray(encodings.y) && encodings.y.length > 1;
    const hasRepetition = hasMltXEnc || hasMltYEnc;
    if (hasRepetition) {
        const xFieldArr = Array.isArray(encodings.x) ? encodings.x : [encodings.x!].filter(Boolean);
        const xFields = xFieldArr.map(f => extractDraggableField(f, hasAggregated, computations, fields, true)!).filter(Boolean);
        if (xFieldArr.length > 1) {
            draggableFieldState.columns = xFields.map(f => ({ ...f, analyticType: 'measure' }));
        } else {
            draggableFieldState.columns = xFields;
        }
        draggableFieldState.columns.forEach(addField);
        const yFieldArr = Array.isArray(encodings.y) ? encodings.y : [encodings.y!].filter(Boolean);
        const yFields = yFieldArr.map(f => extractDraggableField(f, hasAggregated, computations, fields, true)!).filter(Boolean);
        if (yFieldArr.length > 1) {
            draggableFieldState.rows = yFields.map(f => ({ ...f, analyticType: 'measure' }));
        } else {
            draggableFieldState.rows = yFields;
        }
        draggableFieldState.rows.forEach(addField);
    } else {
        const xField = encodings.x ? extractDraggableField(encodings.x as IVisEncodingChannel, hasAggregated, computations, fields, true) : null;
        if (xField) {
            draggableFieldState.columns = [xField];
            draggableFieldState.columns.forEach(addField);
        }
        const yField = encodings.y ? extractDraggableField(encodings.y as IVisEncodingChannel, hasAggregated, computations, fields, true) : null;
        if (yField) {
            draggableFieldState.rows = [yField];
            draggableFieldState.rows.forEach(addField);
        }
    }
    if (encodings.column) {
        const field = extractDraggableField(encodings.column, hasAggregated, computations, fields, false);
        if (field) {
            draggableFieldState.columns.unshift({ ...field, analyticType: 'dimension' });
            draggableFieldState.columns.slice(0, 1).forEach(addField);
        }
    }
    if (encodings.row) {
        const field = extractDraggableField(encodings.row, hasAggregated, computations, fields, false);
        if (field) {
            draggableFieldState.rows.unshift({ ...field, analyticType: 'dimension' });
            draggableFieldState.rows.slice(0, 1).forEach(addField);
        }
    }

    // extract filters
    if (filters) {
        draggableFieldState.filters = filters.map<IFilterField>(filter => {
            const f = fields.find(f => f.fid === filter.field);
            if (!f) {
                return null!;
            }
            return {
                ...f,
                name: f.name ?? filter.field,
                dragId: nanoid(),
                rule: filter.type === 'oneOf' ? {
                    type: 'one of',
                    value: new Set(filter.value),
                } : {
                    type: f.semanticType === 'temporal' ? 'temporal range' : 'range',
                    value: [filter.min, filter.max],
                },
            };
        }).filter(Boolean);
        draggableFieldState.filters.forEach(addField);
    }

    // resolve computed fields
    if (computations) {
        for (const computation of computations) {
            const inferredAnalyticType = computation.type === 'quantitative' ? 'measure' : 'dimension';
            addField({
                fid: computation.field,
                name: computation.name,
                semanticType: computation.type,
                analyticType: inferredAnalyticType,
                computed: true,
                expression: computation.expression,
            });
        }
    }

    // add other fields
    for (const field of fields) {
        addField({
            ...field,
            name: field.name ?? field.fid,
        });
    }
    
    return {
        datasetId,
        draggableFieldState,
        visualConfig,
        vegaConfig,
    };
};
