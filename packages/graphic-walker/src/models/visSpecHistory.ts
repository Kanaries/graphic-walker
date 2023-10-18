import {
    IChart,
    IMutField,
    DraggableFieldState,
    IFilterRule,
    IViewField,
    ISortMode,
    IAggregator,
    SetToArray,
    IVisualLayout,
    IChartForExport,
    IVisualConfigNew,
    IVisSpec,
    PartialChart,
    ICoordMode,
    IGeoUrl,
    ISemanticType,
} from '../interfaces';
import type { FeatureCollection } from 'geojson';
import { createCountField, createVirtualFields } from '../utils';
import { decodeFilterRule, encodeFilterRule } from '../utils/filter';
import { emptyEncodings, emptyVisualConfig, emptyVisualLayout } from '../utils/save';
import { AssertSameKey, KVTuple, insert, mutPath, remove, replace, uniqueId } from './utils';
import { WithHistory, atWith, create, freeze, performWith, redoWith, undoWith } from './withHistory';
import { GLOBAL_CONFIG } from '../config';
import { DATE_TIME_DRILL_LEVELS, DATE_TIME_FEATURE_LEVELS } from '../constants';

type normalKeys = keyof Omit<DraggableFieldState, 'filters'>;

// note: only add new methods at end
export enum Methods {
    setConfig,
    removeField,
    reorderField,
    moveField,
    cloneField,
    createBinlogField,
    appendFilter,
    modFilter,
    writeFilter,
    setName,
    applySort,
    transpose,
    setLayout,
    setFieldAggregator,
    setGeoData,
    setCoordSystem,
    createDateDrillField,
    createDateFeatureField,
    changeSemanticType,
}
type PropsMap = {
    [Methods.setConfig]: KVTuple<IVisualConfigNew>;
    [Methods.removeField]: [keyof DraggableFieldState, number];
    [Methods.reorderField]: [keyof DraggableFieldState, number, number];
    [Methods.moveField]: [normalKeys, number, normalKeys, number, number | null];
    [Methods.cloneField]: [normalKeys, number, normalKeys, number, string, number | null];
    [Methods.createBinlogField]: [normalKeys, number, 'bin' | 'binCount' | 'log10' | 'log2' | 'log', string, number];
    [Methods.appendFilter]: [number, normalKeys, number, string];
    [Methods.modFilter]: [number, normalKeys, number];
    [Methods.writeFilter]: [number, SetToArray<IFilterRule> | null];
    [Methods.setName]: [string];
    [Methods.applySort]: [ISortMode];
    [Methods.transpose]: [];
    [Methods.setLayout]: [KVTuple<IVisualLayout>[]];
    [Methods.setFieldAggregator]: [normalKeys, number, IAggregator];
    [Methods.setGeoData]: [FeatureCollection | undefined, string | undefined, IGeoUrl | undefined];
    [Methods.setCoordSystem]: [ICoordMode];
    [Methods.createDateDrillField]: [normalKeys, number, (typeof DATE_TIME_DRILL_LEVELS)[number], string, string, string | undefined];
    [Methods.createDateFeatureField]: [normalKeys, number, (typeof DATE_TIME_FEATURE_LEVELS)[number], string, string, string | undefined];
    [Methods.changeSemanticType]: [normalKeys, number, ISemanticType];
};
// ensure propsMap has all keys of methods
type assertPropsMap = AssertSameKey<PropsMap, { [a in Methods]: any }>;

type VisActionOf<T> = T extends Methods ? [T, ...PropsMap[T]] : never;
// note: should be serializable
type VisAction = VisActionOf<Methods>;

const actions: {
    [a in Methods]: (d: IChart, ...a: PropsMap[a]) => IChart;
} = {
    [Methods.setConfig]: (data, key, value) => mutPath(data, 'config', (c) => ({ ...c, [key]: value })),
    [Methods.removeField]: (data, encoding, index) => mutPath(data, `encodings.${encoding}`, (fields) => remove(fields, index)) as IChart,
    [Methods.reorderField]: (data, encoding, from, to) =>
        mutPath(data, `encodings.${encoding}`, (fields) =>
            fields.map((x, i, a) => {
                if (i === from) return a[to];
                if (i === to) return a[from];
                return x;
            })
        ),
    [Methods.moveField]: (data, from, findex, to, tindex, limit) => {
        const oriField = data.encodings[from][findex];
        const field =
            to === 'dimensions'
                ? mutPath(oriField, 'analyticType', () => 'dimension')
                : to === 'measures'
                ? mutPath(oriField, 'analyticType', () => 'measure')
                : oriField;
        return mutPath(data, 'encodings', (e) => ({
            ...e,
            [from]: remove(data.encodings[from], findex),
            [to]: insert(data.encodings[to], field, tindex).slice(0, limit ?? Infinity),
        }));
    },
    [Methods.cloneField]: (data, from, findex, to, tindex, newVarKey, limit) => {
        const field = { ...data.encodings[from][findex], dragId: newVarKey };
        return mutPath(data, 'encodings', (e) => ({
            ...e,
            [to]: insert(data.encodings[to], field, tindex).slice(0, limit ?? Infinity),
        }));
    },
    [Methods.createBinlogField]: (data, encoding, index, op, newVarKey, num) => {
        const originField = data.encodings[encoding][index];
        const isBin = op.startsWith('bin');
        const channel = isBin ? 'dimensions' : encoding;
        const prefix = isBin ? `${op}${num}` : `log${num}`;
        const newField: IViewField = {
            fid: newVarKey,
            dragId: newVarKey,
            name: `${prefix}(${originField.name})`,
            semanticType: isBin ? 'ordinal' : 'quantitative',
            analyticType: isBin ? 'dimension' : originField.analyticType,
            computed: true,
            expression: {
                op,
                as: newVarKey,
                params: [
                    {
                        type: 'field',
                        value: originField.fid,
                    },
                ],
                num,
            },
        };
        if (!isBin) {
            newField.aggName = 'sum';
        }
        return mutPath(data, `encodings.${channel}`, (a) => a.concat(newField));
    },
    [Methods.appendFilter]: (data, index, from, findex, dragId) => {
        const originField = data.encodings[from][findex];
        return mutPath(data, 'encodings.filters', (filters) =>
            insert(
                filters,
                {
                    ...originField,
                    rule: null,
                    dragId,
                },
                index
            )
        );
    },
    [Methods.modFilter]: (data, index, from, findex) =>
        mutPath(data, 'encodings.filters', (filters) => {
            const originField = data.encodings[from][findex];
            return replace(filters, index, (f) => ({
                ...originField,
                rule: null,
                dragId: f.dragId,
            }));
        }),
    [Methods.writeFilter]: (data, index, rule) =>
        mutPath(data, 'encodings.filters', (filters) => replace(filters, index, (x) => ({ ...x, rule: decodeFilterRule(rule) }))),
    [Methods.setName]: (data, name) => ({
        ...data,
        name,
    }),
    [Methods.applySort]: (data, sort) => {
        const { rows, columns } = data.encodings;
        const yField = rows.length > 0 ? rows[rows.length - 1] : null;
        const xField = columns.length > 0 ? columns[columns.length - 1] : null;
        if (xField !== null && xField.analyticType === 'dimension' && yField !== null && yField.analyticType === 'measure') {
            return mutPath(data, 'encodings.columns', (cols) => replace(cols, cols.length - 1, (x) => ({ ...x, sort })));
        }
        if (xField !== null && xField.analyticType === 'measure' && yField !== null && yField.analyticType === 'dimension') {
            return mutPath(data, 'encodings.rows', (rows) => replace(rows, rows.length - 1, (x) => ({ ...x, sort })));
        }
        return data;
    },
    [Methods.transpose]: (data) =>
        mutPath(data, 'encodings', (e) => ({
            ...e,
            columns: e.rows,
            rows: e.columns,
        })),
    [Methods.setLayout]: (data, kvs) => mutPath(data, 'layout', (l) => Object.assign({}, l, Object.fromEntries(kvs))),
    [Methods.setFieldAggregator]: (data, encoding, index, aggName) =>
        mutPath(data, `encodings.${encoding}`, (f) => replace(f, index, (x) => ({ ...x, aggName }))),
    [Methods.setGeoData]: (data, geojson, geoKey, geoUrl) => mutPath(data, 'layout', (l) => ({ ...l, geojson, geoKey, geoUrl })),
    [Methods.setCoordSystem]: (data, system) =>
        mutPath(data, 'config', (c) => ({
            ...c,
            coordSystem: system,
            geoms: [GLOBAL_CONFIG.GEOM_TYPES[system][0]],
        })),
    [Methods.createDateDrillField]: (data, channel, index, drillLevel, newVarKey, newName, format) => {
        const originField = data.encodings[channel][index];
        const newField: IViewField = {
            fid: newVarKey,
            dragId: newVarKey,
            name: newName,
            semanticType: 'temporal',
            analyticType: originField.analyticType,
            aggName: 'sum',
            computed: true,
            timeUnit: drillLevel,
            expression: {
                op: 'dateTimeDrill',
                as: newVarKey,
                params: [
                    {
                        type: 'field',
                        value: originField.fid,
                    },
                    {
                        type: 'value',
                        value: drillLevel,
                    },
                    ...(format
                        ? [
                              {
                                  type: 'format',
                                  value: format,
                              } as const,
                          ]
                        : []),
                ],
            },
        };
        return mutPath(data, `encodings.${channel}`, (a) => a.concat(newField));
    },
    [Methods.createDateFeatureField]: (data, channel, index, drillLevel, newVarKey, newName, format) => {
        const originField = data.encodings[channel][index];
        const newField: IViewField = {
            fid: newVarKey,
            dragId: newVarKey,
            name: newName,
            semanticType: 'ordinal',
            analyticType: originField.analyticType,
            aggName: 'sum',
            computed: true,
            expression: {
                op: 'dateTimeFeature',
                as: newVarKey,
                params: [
                    {
                        type: 'field',
                        value: originField.fid,
                    },
                    {
                        type: 'value',
                        value: drillLevel,
                    },
                    ...(format
                        ? [
                              {
                                  type: 'format',
                                  value: format,
                              } as const,
                          ]
                        : []),
                ],
            },
        };
        return mutPath(data, `encodings.${channel}`, (a) => a.concat(newField));
    },
    [Methods.changeSemanticType]: (data, channel, index, semanticType) => {
        return mutPath(data, `encodings.${channel}`, (f) => replace(f, index, (x) => ({ ...x, semanticType })));
    },
};

function reducerT<T>(data: IChart, action: VisActionOf<T>): IChart {
    const [type, ...props] = action;
    return actions[type](data, ...props);
}
export type VisSpecWithHistory = WithHistory<IChart, VisAction>;
export const reducer: (data: IChart, action: VisAction) => IChart = reducerT;
export const perform: (data: VisSpecWithHistory, action: VisAction) => VisSpecWithHistory = performWith(reducerT);
export const undo: (data: VisSpecWithHistory) => VisSpecWithHistory = undoWith(reducerT);
export const redo: (data: VisSpecWithHistory) => VisSpecWithHistory = redoWith(reducerT);
export const at: (data: VisSpecWithHistory, cursor: number) => IChart = atWith(reducerT);
export { freeze };

export const performers = Object.fromEntries(
    (Object.keys(Methods) as (keyof typeof Methods)[]).map((k) => [k, (data: any, ...args: any[]) => perform(data, [Methods[k], ...args] as any)])
) as unknown as {
    [K in keyof typeof Methods]: (data: VisSpecWithHistory, ...args: PropsMap[(typeof Methods)[K]]) => VisSpecWithHistory;
};

export function encodeVisSpec(data: IChart): IChartForExport {
    return mutPath(data, 'encodings.filters', (f) =>
        f.map((x) => ({
            ...x,
            rule: encodeFilterRule(x.rule),
        }))
    );
}
export function decodeVisSpec(snapshot: Partial<IChartForExport>): PartialChart {
    return mutPath(snapshot, 'encodings', (e) => {
        const filters = e?.filters?.map((x) => ({
            ...x,
            rule: decodeFilterRule(x.rule),
        }));
        return {
            ...e,
            filters,
        };
    });
}
function emptyChart(visId: string, name: string): IChart {
    return {
        config: emptyVisualConfig,
        encodings: emptyEncodings,
        layout: emptyVisualLayout,
        visId: visId,
        name,
    };
}
export function newChart(fields: IMutField[], name: string, visId?: string): IChart {
    if (fields.length === 0) return emptyChart(visId || uniqueId(), name);
    const extraFields = [...createVirtualFields(), createCountField()];
    const extraDimensions = extraFields.filter((x) => x.analyticType === 'dimension');
    const extraMeasures = extraFields.filter((x) => x.analyticType === 'measure');
    return mutPath(emptyChart(visId || uniqueId(), name), 'encodings', (e) => ({
        ...e,
        dimensions: fields
            .filter((f) => f.analyticType === 'dimension')
            .map(
                (f): IViewField => ({
                    dragId: uniqueId(),
                    fid: f.fid,
                    name: f.name || f.fid,
                    basename: f.basename || f.name || f.fid,
                    semanticType: f.semanticType,
                    analyticType: f.analyticType,
                })
            )
            .concat(extraDimensions),
        measures: fields
            .filter((f) => f.analyticType === 'measure')
            .map(
                (f): IViewField => ({
                    dragId: uniqueId(),
                    fid: f.fid,
                    name: f.name || f.fid,
                    basename: f.basename || f.name || f.fid,
                    analyticType: f.analyticType,
                    semanticType: f.semanticType,
                    aggName: 'sum',
                })
            )
            .concat(extraMeasures),
    }));
}
export function fillChart(chart: PartialChart): IChart {
    const result = emptyChart(chart.visId || uniqueId(), chart.name || 'Chart');
    result.config = {
        ...result.config,
        ...chart.config,
    };
    result.encodings = {
        ...result.encodings,
        ...chart.encodings,
    };
    result.layout = {
        ...result.layout,
        ...chart.layout,
        size: {
            ...result.layout.size,
            ...chart.layout?.size,
        },
    };
    return result;
}
export function fromSnapshot(snapshot: PartialChart): VisSpecWithHistory {
    return create(fillChart(snapshot));
}
export function fromFields(fields: IMutField[], name: string): VisSpecWithHistory {
    return create(newChart(fields, name));
}
type VisSpecHistoryInfoForExport = {
    base: Partial<IChartForExport>;
    timeline: VisAction[];
};
export function exportFullRaw(data: VisSpecWithHistory, maxHistory = 30): string {
    const result: VisSpecHistoryInfoForExport = {
        base: encodeVisSpec(data.cursor > maxHistory ? at(data, data.cursor - maxHistory) : data.base),
        timeline: data.timeline.slice(Math.max(0, data.cursor - maxHistory)),
    };
    return JSON.stringify(result);
}

export function exportNow(data: VisSpecWithHistory) {
    return encodeVisSpec(data.now);
}

export function importNow(data: IChartForExport) {
    return fromSnapshot(decodeVisSpec(data));
}

export function importFull(data: string): VisSpecWithHistory {
    const result: VisSpecHistoryInfoForExport = JSON.parse(data);
    const base = fromSnapshot(decodeVisSpec(result.base));
    return result.timeline.reduce(perform, base);
}

export function resolveChart(data: string): IChart {
    const result: VisSpecHistoryInfoForExport = JSON.parse(data);
    const base = fillChart(decodeVisSpec(result.base));
    return result.timeline.reduce(reducer, base);
}

export function convertChart(data: IVisSpec): IChart {
    const result = emptyChart(data.visId, data.name || 'Chart');
    result.config = {
        ...result.config,
        defaultAggregated: data.config.defaultAggregated,
        geoms: data.config.geoms?.slice() ?? [],
        limit: data.config.limit,
        coordSystem: data.config.coordSystem,
        folds: data.config.folds,
    };
    result.encodings = {
        ...result.encodings,
        dimensions: data.encodings.dimensions?.slice() ?? [],
        measures: data.encodings.measures?.slice() ?? [],
        rows: data.encodings.rows?.slice() ?? [],
        columns: data.encodings.columns?.slice() ?? [],
        color: data.encodings.color?.slice() ?? [],
        opacity: data.encodings.opacity?.slice() ?? [],
        size: data.encodings.size?.slice() ?? [],
        shape: data.encodings.shape?.slice() ?? [],
        theta: data.encodings.theta?.slice() ?? [],
        radius: data.encodings.radius?.slice() ?? [],
        longitude: data.encodings.longitude?.slice() ?? [],
        latitude: data.encodings.latitude?.slice() ?? [],
        geoId: data.encodings.geoId?.slice() ?? [],
        details: data.encodings.details?.slice() ?? [],
        filters: data.encodings.filters?.slice() ?? [],
        text: data.encodings.text?.slice() ?? [],
    };
    result.layout = {
        ...result.layout,
        background: data.config.background,
        format: data.config.format,
        interactiveScale: data.config.interactiveScale,
        resolve: data.config.resolve,
        showActions: data.config.showActions,
        stack: data.config.stack,
        zeroScale: data.config.zeroScale,
        size: {
            ...result.layout.size,
            ...data.config.size,
        },
        colorPalette: data.config.colorPalette,
        geojson: data.config.geojson,
        geoKey: data.config.geoKey,
        geoUrl: data.config.geoUrl,
        primaryColor: data.config.primaryColor,
        scale: data.config.scale,
        scaleIncludeUnmatchedChoropleth: data.config.scaleIncludeUnmatchedChoropleth,
        showTableSummary: data.config.showTableSummary,
        useSvg: data.config.useSvg,
    };
    return result;
}
