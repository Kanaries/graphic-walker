import type { DeepReadonly, DraggableFieldState, IVisualConfig, IViewField, IStackMode, ISemanticType } from "../../interfaces";
import type { IAggregator } from "../../interfaces";
import { autoMark } from "../spec/mark";
import type { IVisEncodingChannel, IVisEncodings, IVisFilter, IVisSpec } from "./interface";


interface IGWSpec {
    datasetId: string;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: IVisualConfig;
}

const extractVisEncChannel = (
    enc: DeepReadonly<IViewField>,
    defaultAggregate: boolean,
    allowSort = false,
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
    if (allowSort && sort && sort !== 'none') {
        // apply sort
        channel.sort = sort === 'ascending' ? 'asc' : 'desc';
    }
    if (stack !== 'none') {
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
            enc.y = rowRepeatFields.map(f => extractVisEncChannel(f, defaultAggregate, true, stack));
        }
        if (colRepeatFields.length) {
            enc.x = colRepeatFields.map(f => extractVisEncChannel(f, defaultAggregate, true, stack));
        }
    } else {
        // no repeat
        const yField = rows.length > 0 ? rows[rows.length - 1] : null;
        const xField = columns.length > 0 ? columns[columns.length - 1] : null;

        if (yField) {
            enc.y = extractVisEncChannel(yField, defaultAggregate, true, stack);
        }
        if (xField) {
            enc.x = extractVisEncChannel(xField, defaultAggregate, true, stack);
        }
    }

    return enc;
};

const nonPositionChannels = ['color', 'opacity', 'size', 'shape', 'theta', 'radius', 'details', 'text'] as const;

export const transformGWSpec2VisSpec = (spec: IGWSpec): IVisSpec => {
    const { datasetId, draggableFieldState, visualConfig } = spec;
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

    const dsl: IVisSpec = {
        datasetId,
        markType,
        encodings: enc,
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
    
    return dsl;
};
