import { IReactionDisposer, makeAutoObservable, observable, computed, reaction, toJS } from 'mobx';
import produce from 'immer';
import { feature } from 'topojson-client';
import type { FeatureCollection } from "geojson";
import {
    DataSet,
    DraggableFieldState,
    IFilterRule,
    IGeographicData,
    ISortMode,
    IStackMode,
    IViewField,
    IVisSpec,
    IVisSpecForExport,
    IFilterFieldForExport,
    IVisualConfig,
    Specification,
    IComputationFunction,
} from '../interfaces';
import { CHANNEL_LIMIT, GEMO_TYPES, MetaFieldKeys } from '../config';
import { VisSpecWithHistory } from '../models/visSpecHistory';
import {
    IStoInfo,
    dumpsGWPureSpec,
    parseGWContent,
    parseGWPureSpec,
    stringifyGWContent,
    initVisualConfig,
    forwardVisualConfigs,
    visSpecDecoder,
    initEncoding,
} from '../utils/save';
import { CommonStore } from './commonStore';
import { createCountField } from '../utils';
import { COUNT_FIELD_ID } from '../constants';
import { nanoid } from 'nanoid';
import { toWorkflow } from '../utils/workflow';

function getChannelSizeLimit(channel: string): number {
    if (typeof CHANNEL_LIMIT[channel] === 'undefined') return Infinity;
    return CHANNEL_LIMIT[channel];
}

function uniqueId(): string {
    return 'gw_' + nanoid(4);
}

function geomAdapter(geom: string) {
    switch (geom) {
        case 'interval':
        case 'bar':
            return 'bar';
        case 'line':
            return 'line';
        case 'boxplot':
            return 'boxplot';
        case 'area':
            return 'area';
        case 'point':
            return 'point';
        case 'arc':
            return 'arc';
        case 'circle':
            return 'circle';
        case 'heatmap':
            return 'circle';
        case 'rect':
            return 'rect';
        case 'tick':
        default:
            return 'tick';
    }
}

function stackValueTransform(vlValue: string | undefined | null): IStackMode {
    if (vlValue === 'center') return 'center';
    if (vlValue === 'normalize') return 'normalize';
    if (vlValue === 'zero') return 'zero';
    return 'none';
}

function sortValueTransform(vlValue: object | string | null): ISortMode {
    let order: string = 'none';
    if (typeof vlValue === 'string') {
        order = vlValue;
    } else if (vlValue && vlValue instanceof Object) {
        order = vlValue['order'] ?? 'ascending';
    }
    if (order !== 'none') {
        const channels: string[] = ['x', 'y', 'color', 'size', 'opacity'];
        // TODO: support all sorting config in vl
        if (order.startsWith('-') || order === 'descending') return 'descending';
        if (channels.indexOf(order) > -1 || order === 'ascending') return 'ascending';
    }
    return 'none';
}

type DeepReadonly<T extends Record<keyof any, any>> = {
    readonly [K in keyof T]: T[K] extends Record<keyof any, any> ? DeepReadonly<T[K]> : T[K];
};

function isDraggableStateEmpty(state: DeepReadonly<DraggableFieldState>): boolean {
    return Object.values(state).every((value) => value.length === 0);
}

function withTimeout<T extends any[], U>(f: (...args: T) => Promise<U>, timeout: number){
    return (...args: T) => Promise.race([f(...args), new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeout)
    })])
}

export class VizSpecStore {
    // public fields: IViewField[] = [];
    private commonStore: CommonStore;
    /**
     * This segment will always refers to the state of the active tab -
     * `this.visList[this.visIndex].encodings`.
     * Notice that observing rule of `this.visList` is `"shallow"`
     * so mobx will NOT compare every deep value of `this.visList`,
     * because the active tab is the only item in the list that may change.
     * @readonly
     * Assignment or mutable operations applied to ANY members of this segment
     * is strictly FORBIDDEN.
     * Members of it can only be got as READONLY objects.
     *
     * If you're trying to change the value of it and let mobx catch the action to trigger an update,
     * please use `this.useMutable()` to access to a writable reference
     * (an `immer` draft) of `this.visList[this.visIndex]`.
     */
    public readonly draggableFieldState: DeepReadonly<DraggableFieldState>;
    private reactions: IReactionDisposer[] = [];
    /**
     * This segment will always refers to the state of the active tab -
     * `this.visList[this.visIndex].config`.
     * Notice that observing rule of `this.visList` is `"shallow"`
     * so mobx will NOT compare every deep value of `this.visList`,
     * because the active tab is the only item in the list that may change.
     * @readonly
     * Assignment or mutable operations applied to ANY members of this segment
     * is strictly FORBIDDEN.
     * Members of it can only be got as READONLY objects.
     *
     * If you're trying to change the value of it and let mobx catch the action to trigger an update,
     * please use `this.useMutable()` to access to a writable reference
     * (an `immer` draft) of `this.visList[this.visIndex]`.
     */
    public readonly visualConfig: Readonly<IVisualConfig>;
    public visList: VisSpecWithHistory[] = [];
    public visIndex: number = 0;
    public canUndo = false;
    public canRedo = false;
    public editingFilterIdx: number | null = null;
    // TODO
    public computationFunction: IComputationFunction = async () => [];
    constructor(commonStore: CommonStore) {
        this.commonStore = commonStore;
        this.draggableFieldState = initEncoding();
        this.visualConfig = initVisualConfig();
        this.visList.push(
            new VisSpecWithHistory({
                name: 'Chart 1',
                visId: uniqueId(),
                config: this.visualConfig,
                encodings: this.draggableFieldState,
            })
        );
        makeAutoObservable(this, {
            visList: observable.shallow,
            computationFunction: observable.ref,
            // @ts-expect-error private fields are not supported
            reactions: false,
        });
        this.reactions.push(
            reaction(
                () => this.visList[this.visIndex],
                (frame) => {
                    // @ts-ignore Allow assignment here to trigger watch
                    this.draggableFieldState = frame.encodings;
                    // @ts-ignore Allow assignment here to trigger watch
                    this.visualConfig = frame.config;
                    this.canUndo = frame.canUndo;
                    this.canRedo = frame.canRedo;
                }
            ),
            reaction(
                () => commonStore.currentDataset,
                (dataset) => {
                    // this.initState();
                    if (isDraggableStateEmpty(this.draggableFieldState) && dataset.dataSource.length > 0 && dataset.rawFields.length > 0) {
                        this.initMetaState(dataset);
                    }
                }
            )
        );
    }
    private __dangerous_is_inside_useMutable__ = false;
    /**
     * @important NEVER recursively call `useMutable()`
     * because the state will be overwritten by the root `useMutable()` call,
     * update caused by recursive `useMutable()` call will be reverted or lead to unexpected behaviors.
     * Inline your invoking or just use block with IF statement to avoid this in your cases.
     *
     * Allow to change any deep member of `encodings` or `config`
     * in the active tab `this.visList[this.visIndex]`.
     *
     * - `tab.encodings`
     *
     * A mutable reference of `this.draggableFieldState`
     *
     * - `tab.config`
     *
     * A mutable reference of `this.visualConfig`
     */
    private useMutable(cb: (tab: { encodings: DraggableFieldState; config: IVisualConfig }) => void) {
        if (this.__dangerous_is_inside_useMutable__) {
            throw new Error(
                'A recursive call of useMutable() is detected, ' + 'this is prevented because update will be overwritten by parent execution context.'
            );
        }

        this.__dangerous_is_inside_useMutable__ = true;

        const { encodings, config } = produce(
            {
                encodings: this.visList[this.visIndex].encodings,
                config: this.visList[this.visIndex].config,
            },
            (draft) => {
                cb(draft);
            }
        ); // notice that cb() may unexpectedly returns a non-nullable value

        this.visList[this.visIndex].encodings = encodings;
        this.visList[this.visIndex].config = config;

        this.canUndo = this.visList[this.visIndex].canUndo;
        this.canRedo = this.visList[this.visIndex].canRedo;

        // @ts-ignore Allow assignment here to trigger watch
        this.visualConfig = config;
        // @ts-ignore Allow assignment here to trigger watch
        this.draggableFieldState = encodings;

        this.__dangerous_is_inside_useMutable__ = false;
    }
    public undo() {
        if (this.visList[this.visIndex]?.undo()) {
            this.canUndo = this.visList[this.visIndex].canUndo;
            this.canRedo = this.visList[this.visIndex].canRedo;
            // @ts-ignore Allow assignment here to trigger watch
            this.visualConfig = this.visList[this.visIndex].config;
            // @ts-ignore Allow assignment here to trigger watch
            this.draggableFieldState = this.visList[this.visIndex].encodings;
        }
    }
    public redo() {
        if (this.visList[this.visIndex]?.redo()) {
            this.canUndo = this.visList[this.visIndex].canUndo;
            this.canRedo = this.visList[this.visIndex].canRedo;
            // @ts-ignore Allow assignment here to trigger watch
            this.visualConfig = this.visList[this.visIndex].config;
            // @ts-ignore Allow assignment here to trigger watch
            this.draggableFieldState = this.visList[this.visIndex].encodings;
        }
    }
    private freezeHistory() {
        this.visList[this.visIndex]?.rebase();
        this.canUndo = this.visList[this.visIndex].canUndo;
        this.canRedo = this.visList[this.visIndex].canRedo;
    }
    /**
     * dimension fields in visualization
     */
    public get viewDimensions(): IViewField[] {
        const { draggableFieldState } = this;
        const { filters, ...state } = toJS(draggableFieldState);
        const fields: IViewField[] = [];
        (Object.keys(state) as (keyof DraggableFieldState)[])
            .filter((dkey) => !MetaFieldKeys.includes(dkey))
            .forEach((dkey) => {
                fields.push(...state[dkey].filter((f) => f.analyticType === 'dimension'));
            });
        return fields;
    }
    /**
     * dimension fields in visualization
     */
    public get viewMeasures(): IViewField[] {
        const { draggableFieldState } = this;
        const { filters, ...state } = toJS(draggableFieldState);
        const fields: IViewField[] = [];
        (Object.keys(state) as (keyof DraggableFieldState)[])
            .filter((dkey) => !MetaFieldKeys.includes(dkey))
            .forEach((dkey) => {
                fields.push(...state[dkey].filter((f) => f.analyticType === 'measure'));
            });
        return fields;
    }
    public get allFields(): IViewField[] {
        const { draggableFieldState } = this;
        const dimensions = toJS(draggableFieldState.dimensions);
        const measures = toJS(draggableFieldState.measures);
        return [...dimensions, ...measures];
    }
    public get viewFilters() {
        const { draggableFieldState } = this;
        const state = toJS(draggableFieldState);
        return state.filters;
    }

    public addVisualization(defaultName?: string) {
        const name = defaultName || 'Chart ' + (this.visList.length + 1);
        this.visList.push(
            new VisSpecWithHistory({
                name,
                visId: uniqueId(),
                config: initVisualConfig(),
                encodings: initEncoding(),
            })
        );
        this.visIndex = this.visList.length - 1;
    }
    public selectVisualization(visIndex: number) {
        this.visIndex = visIndex;
    }
    public setVisName(visIndex: number, name: string) {
        this.visList[visIndex] = this.visList[visIndex].clone();
        this.visList[visIndex].updateLatest({
            name,
        });
    }
    public initState() {
        this.useMutable((tab) => {
            tab.encodings = initEncoding();
            this.freezeHistory();
        });
    }
    public initMetaState(dataset: DataSet) {
        const countField = createCountField();
        this.useMutable(({ encodings }) => {
            encodings.dimensions = dataset.rawFields
                .filter((f) => f.analyticType === 'dimension')
                .map((f) => ({
                    dragId: uniqueId(),
                    fid: f.fid,
                    name: f.name || f.fid,
                    basename: f.basename || f.name || f.fid,
                    semanticType: f.semanticType,
                    analyticType: f.analyticType,
                }));
            encodings.measures = dataset.rawFields
                .filter((f) => f.analyticType === 'measure')
                .map((f) => ({
                    dragId: uniqueId(),
                    fid: f.fid,
                    name: f.name || f.fid,
                    basename: f.basename || f.name || f.fid,
                    analyticType: f.analyticType,
                    semanticType: f.semanticType,
                    aggName: 'sum',
                }));
            encodings.measures.push(countField);
        });

        this.freezeHistory();
    }
    /**
     * clear all config in draggable state
     */
    public clearState() {
        this.useMutable(({ encodings }) => {
            for (let key in encodings) {
                if (!MetaFieldKeys.includes(key as keyof DraggableFieldState)) {
                    encodings[key] = [];
                }
            }
        });
    }
    public setVisualConfig<K extends keyof IVisualConfig>(configKey: K, value: IVisualConfig[K]) {
        this.useMutable(({ config }) => {
            switch (true) {
                case ['defaultAggregated', 'defaultStack', 'showActions', 'interactiveScale', 'scaleIncludeUnmatchedChoropleth'].includes(configKey): {
                    return ((config as unknown as { [k: string]: boolean })[configKey] = Boolean(value));
                }
                case configKey === 'geoms' && Array.isArray(value):
                case configKey === "coordSystem":
                case configKey === 'size' && typeof value === 'object':
                case configKey === 'sorted':
                case configKey === 'zeroScale':
                case configKey === 'background':
                case configKey === 'resolve':
                case configKey === 'limit':
                case configKey === 'stack': {
                    return (config[configKey] = value);
                }
                case configKey === 'format' && typeof value === 'object': {
                    return (config[configKey] = value);
                }

                default: {
                    console.error('[unknown key] ' + configKey + ' You should registered visualConfig at setVisualConfig');
                }
            }
        });
    }
    public transformCoord(coord: 'cartesian' | 'polar') {
        if (coord === 'polar') {
        }
    }
    public setChartLayout(props: { mode: IVisualConfig['size']['mode']; width?: number; height?: number }) {
        this.useMutable(({ config }) => {
            const { mode = config.size.mode, width = config.size.width, height = config.size.height } = props;

            config.size.mode = mode;
            config.size.width = width;
            config.size.height = height;
        });
    }
    public reorderField(stateKey: keyof DraggableFieldState, sourceIndex: number, destinationIndex: number) {
        if (MetaFieldKeys.includes(stateKey)) return;
        if (sourceIndex === destinationIndex) return;

        this.useMutable(({ encodings }) => {
            const fields = encodings[stateKey];
            const [field] = fields.splice(sourceIndex, 1);
            fields.splice(destinationIndex, 0, field);
        });
    }
    public moveField(sourceKey: keyof DraggableFieldState, sourceIndex: number, destinationKey: keyof DraggableFieldState, destinationIndex: number) {
        if (sourceKey === 'filters') {
            return this.removeField(sourceKey, sourceIndex);
        } else if (destinationKey === 'filters') {
            return this.appendFilter(destinationIndex, this.draggableFieldState[sourceKey][sourceIndex]);
        }

        this.useMutable(({ encodings }) => {
            let movingField: IViewField;
            // 来源是不是metafield，是->clone；不是->直接删掉
            if (MetaFieldKeys.includes(sourceKey)) {
                // use a different dragId
                movingField = {
                    ...toJS(encodings[sourceKey][sourceIndex]), // toJS will NOT shallow copy a object here
                    dragId: uniqueId(),
                };
            } else {
                [movingField] = encodings[sourceKey].splice(sourceIndex, 1);
            }
            // 目的地是metafields的情况，只有在来源也是metafields时，会执行字段类型转化操作
            if (MetaFieldKeys.includes(destinationKey)) {
                if (!MetaFieldKeys.includes(sourceKey)) return;
                encodings[sourceKey].splice(sourceIndex, 1);
                movingField.analyticType = destinationKey === 'dimensions' ? 'dimension' : 'measure';
            }
            const limitSize = getChannelSizeLimit(destinationKey);
            const fixedDestinationIndex = Math.min(destinationIndex, limitSize - 1);
            const overflowSize = Math.max(0, encodings[destinationKey].length + 1 - limitSize);
            encodings[destinationKey].splice(fixedDestinationIndex, overflowSize, movingField);
        });
    }
    public removeField(sourceKey: keyof DraggableFieldState, sourceIndex: number) {
        if (MetaFieldKeys.includes(sourceKey)) return;

        this.useMutable(({ encodings }) => {
            const fields = encodings[sourceKey];
            fields.splice(sourceIndex, 1);
        });
    }
    public replaceField(sourceKey: keyof DraggableFieldState, sourceIndex: number, fid: string) {
        if (MetaFieldKeys.includes(sourceKey)) return;
        const enteringField = [...this.draggableFieldState.dimensions, ...this.draggableFieldState.measures].find((which) => which.fid === fid);
        if (!enteringField) {
            return;
        }

        this.useMutable(({ encodings }) => {
            const fields = encodings[sourceKey];
            fields.splice(sourceIndex, 1, toJS(enteringField));
        });
    }
    private appendFilter(index: number, data: IViewField) {
        this.useMutable(({ encodings }) => {
            encodings.filters.splice(index, 0, {
                ...toJS(data),
                dragId: uniqueId(),
                rule: null,
            });
            this.editingFilterIdx = index;
        });
    }
    public writeFilter(index: number, rule: IFilterRule | null) {
        this.useMutable(({ encodings }) => {
            encodings.filters[index].rule = rule;
        });
    }
    public setFilterEditing(index: number) {
        this.editingFilterIdx = index;
    }
    public closeFilterEditing() {
        this.editingFilterIdx = null;
    }
    public transpose() {
        this.useMutable(({ encodings }) => {
            const fieldsInCup = encodings.columns;

            encodings.columns = encodings.rows;
            encodings.rows = fieldsInCup as typeof encodings.rows; // assume this as writable

            const fieldsInCup2 = encodings.longitude;
            encodings.longitude = encodings.latitude;
            encodings.latitude = fieldsInCup2 as typeof encodings.latitude; // assume this as writable
        });
    }
    public createBinField(stateKey: keyof DraggableFieldState, index: number, binType: 'bin' | 'binCount'): string {
        const newVarKey = uniqueId();
        const state = this.draggableFieldState;
        const existedRelatedBinField = state.dimensions.find(
            (f) => f.computed && f.expression && f.expression.op === binType && f.expression.params[0].value === state[stateKey][index].fid
        );
        if (existedRelatedBinField) {
            return existedRelatedBinField.fid;
        }
        this.useMutable(({ encodings }) => {
            const originField = encodings[stateKey][index];
            const binField: IViewField = {
                fid: newVarKey,
                dragId: newVarKey,
                name: `${binType}(${originField.name})`,
                semanticType: 'ordinal',
                analyticType: 'dimension',
                computed: true,
                expression: {
                    op: binType,
                    as: newVarKey,
                    params: [
                        {
                            type: 'field',
                            value: originField.fid,
                        },
                    ],
                },
            };
            encodings.dimensions.push(binField);
        });
        return newVarKey;
    }
    public createLogField(stateKey: keyof DraggableFieldState, index: number, scaleType: 'log10' | 'log2') {
        if (stateKey === 'filters') {
            return;
        }

        this.useMutable(({ encodings }) => {
            const originField = encodings[stateKey][index];
            const newVarKey = uniqueId();
            const logField: IViewField = {
                fid: newVarKey,
                dragId: newVarKey,
                name: `${scaleType}(${originField.name})`,
                semanticType: 'quantitative',
                analyticType: originField.analyticType,
                aggName: 'sum',
                computed: true,
                expression: {
                    op: scaleType,
                    as: newVarKey,
                    params: [
                        {
                            type: 'field',
                            value: originField.fid,
                        },
                    ],
                },
            };
            encodings[stateKey].push(logField);
        });
    }
    public setFieldAggregator(stateKey: keyof DraggableFieldState, index: number, aggName: string) {
        this.useMutable(({ encodings }) => {
            const fields = encodings[stateKey];

            if (fields[index]) {
                encodings[stateKey][index].aggName = aggName;
            }
        });
    }
    public get sortCondition() {
        const { rows, columns } = this.draggableFieldState;
        const yField = rows.length > 0 ? rows[rows.length - 1] : null;
        const xField = columns.length > 0 ? columns[columns.length - 1] : null;
        if (xField !== null && xField.analyticType === 'dimension' && yField !== null && yField.analyticType === 'measure') {
            return true;
        }
        if (xField !== null && xField.analyticType === 'measure' && yField !== null && yField.analyticType === 'dimension') {
            return true;
        }
        return false;
    }
    public setFieldSort(stateKey: keyof DraggableFieldState, index: number, sortType: ISortMode) {
        this.useMutable(({ encodings }) => {
            encodings[stateKey][index].sort = sortType;
        });
    }
    public applyDefaultSort(sortType: ISortMode = 'ascending') {
        this.useMutable(({ encodings }) => {
            const { rows, columns } = encodings;
            const yField = rows.length > 0 ? rows[rows.length - 1] : null;
            const xField = columns.length > 0 ? columns[columns.length - 1] : null;

            if (xField !== null && xField.analyticType === 'dimension' && yField !== null && yField.analyticType === 'measure') {
                encodings.columns[columns.length - 1].sort = sortType;
                return;
            }
            if (xField !== null && xField.analyticType === 'measure' && yField !== null && yField.analyticType === 'dimension') {
                encodings.rows[rows.length - 1].sort = sortType;
                return;
            }
        });
    }
    public appendField(destinationKey: keyof DraggableFieldState, field: IViewField | undefined, overrideAttr?: Record<string, any>) {
        if (MetaFieldKeys.includes(destinationKey)) return;
        if (typeof field === 'undefined') return;
        if (destinationKey === 'filters') {
            return;
        }

        this.useMutable(({ encodings }) => {
            const cloneField = { ...toJS(field), ...overrideAttr };
            cloneField.dragId = uniqueId();
            encodings[destinationKey].push(cloneField);
        });
    }
    public setVizFormatConfig(formatKey: keyof IVisualConfig['format'], value?: string) {
        this.visualConfig[formatKey] = value;
    }
    public renderVLSubset(vlStruct: any) {
        const tab = this.visList[this.visIndex];
        this.clearState();
        this.setVisualConfig('defaultAggregated', false);
        this.setVisualConfig('stack', 'stack');
        // this.setVisualConfig('sorted', 'none')
        this.applyDefaultSort('none');

        if (!tab) return;
        const fields = tab.encodings.dimensions.concat(tab.encodings.measures);
        const countField = fields.find((f) => f.fid === COUNT_FIELD_ID);
        const renderVLFacet = (vlFacet) => {
            if (vlFacet.facet) {
                this.appendField('rows', fields.find((f) => f.fid === vlFacet.facet.field) || countField, { analyticType: 'dimension' });
            }
            if (vlFacet.row) {
                this.appendField('rows', fields.find((f) => f.fid === vlFacet.row.field) || countField, { analyticType: 'dimension' });
            }
            if (vlFacet.column) {
                this.appendField('columns', fields.find((f) => f.fid === vlFacet.column.field) || countField, { analyticType: 'dimension' });
            }
        };
        const isValidAggregate = (aggName) => aggName && ['sum', 'count', 'max', 'min', 'mean', 'median', 'variance', 'stdev'].includes(aggName);
        const renderVLSpec = (vlSpec) => {
            if (typeof vlSpec.mark === 'string') {
                this.setVisualConfig('geoms', [geomAdapter(vlSpec.mark)]);
            } else {
                this.setVisualConfig('geoms', [geomAdapter(vlSpec.mark.type)]);
            }
            if (vlSpec.encoding.x) {
                const field = fields.find((f) => f.fid === vlSpec.encoding.x.field) || countField;
                this.appendField('columns', field, { analyticType: 'dimension' });
                if (isValidAggregate(vlSpec.encoding.x.aggregate) || field === countField) {
                    this.setVisualConfig('defaultAggregated', true);
                    this.setFieldAggregator('columns', this.draggableFieldState.columns.length - 1, vlSpec.encoding.x.aggregate);
                }
                if (vlSpec.encoding.x.bin) {
                    const binFid = this.createBinField('columns', this.draggableFieldState.columns.length - 1, 'bin');
                    this.replaceField('columns', this.draggableFieldState.columns.length - 1, binFid);
                }
                if (vlSpec.encoding.x.stack) {
                    this.setVisualConfig('stack', stackValueTransform(vlSpec.encoding.x.stack));
                }
            }
            if (vlSpec.encoding.y) {
                const field = fields.find((f) => f.fid === vlSpec.encoding.y.field) || countField;
                this.appendField('rows', field, { analyticType: 'measure' });
                if (isValidAggregate(vlSpec.encoding.y.aggregate) || field === countField) {
                    this.setVisualConfig('defaultAggregated', true);
                    this.setFieldAggregator('rows', this.draggableFieldState.rows.length - 1, vlSpec.encoding.y.aggregate);
                }
                if (vlSpec.encoding.y.bin) {
                    const binFid = this.createBinField('rows', this.draggableFieldState.rows.length - 1, 'bin');
                    this.replaceField('rows', this.draggableFieldState.rows.length - 1, binFid);
                }
                if (vlSpec.encoding.y.stack) {
                    this.setVisualConfig('stack', stackValueTransform(vlSpec.encoding.y.stack));
                }
            }

            (['color', 'opacity', 'shape', 'size', 'details', 'theta', 'text', 'radius'] as (keyof DraggableFieldState)[]).forEach((ch) => {
                if (vlSpec.encoding[ch]) {
                    const field = fields.find((f) => f.fid === vlSpec.encoding[ch].field) || countField;
                    this.appendField(
                        ch,
                        field,
                        field !== countField && ['color', 'opacity', 'size', 'radius'].includes(ch)
                            ? { analyticType: 'dimension' }
                            : field === countField || ['theta'].includes(ch)
                            ? { analyticType: 'measure' }
                            : {}
                    );
                    const aggregate = isValidAggregate(vlSpec.encoding[ch].aggregate);
                    if ((['theta', 'radius'].includes(ch) && aggregate) || field === countField) {
                        this.setVisualConfig('defaultAggregated', true);
                        if (aggregate) {
                            this.setFieldAggregator(ch, this.draggableFieldState[ch].length - 1, vlSpec.encoding[ch].aggregate);
                        }
                    }
                }
            });
            ['x', 'y', 'facet'].forEach((ch) => {
                if (vlSpec.encoding[ch] && vlSpec.encoding[ch].sort) {
                    this.applyDefaultSort(sortValueTransform(vlSpec.encoding[ch].sort));
                }
            });
            if (vlSpec.encoding.order && vlSpec.encoding.order.sort) {
                this.applyDefaultSort(sortValueTransform(vlSpec.encoding.order.sort));
            }
        };
        if (vlStruct.encoding && vlStruct.mark) {
            renderVLFacet(vlStruct.encoding);
            renderVLSpec(vlStruct);
        } else if (vlStruct.spec) {
            if (vlStruct.facet) {
                renderVLFacet(vlStruct.facet);
            }
            renderVLSpec(vlStruct.spec);
        }
    }
    public renderSpec(spec: Specification) {
        const tab = this.visList[this.visIndex];

        if (tab) {
            const fields = tab.encodings.dimensions.concat(tab.encodings.measures);
            // thi
            // const [xField, yField, ] = spec.position;
            this.clearState();
            this.setVisualConfig('defaultAggregated', Boolean(spec.aggregate));
            if ((spec.geomType?.length ?? 0) > 0) {
                this.setVisualConfig(
                    'geoms',
                    spec.geomType!.map((g) => geomAdapter(g))
                );
            }
            if ((spec.facets?.length ?? 0) > 0) {
                const facets = (spec.facets || []).concat(spec.highFacets || []);
                for (let facet of facets) {
                    this.appendField(
                        'rows',
                        fields.find((f) => f.fid === facet)
                    );
                }
            }
            if (spec.position) {
                const [cols, rows] = spec.position;
                if (cols)
                    this.appendField(
                        'columns',
                        fields.find((f) => f.fid === cols)
                    );
                if (rows)
                    this.appendField(
                        'rows',
                        fields.find((f) => f.fid === rows)
                    );
            }
            if ((spec.color?.length ?? 0) > 0) {
                this.appendField(
                    'color',
                    fields.find((f) => f.fid === spec.color![0])
                );
            }
            if ((spec.size?.length ?? 0) > 0) {
                this.appendField(
                    'size',
                    fields.find((f) => f.fid === spec.size![0])
                );
            }
            if ((spec.opacity?.length ?? 0) > 0) {
                this.appendField(
                    'opacity',
                    fields.find((f) => f.fid === spec.opacity![0])
                );
            }
        }
    }
    public destroy() {
        this.reactions.forEach((rec) => {
            rec();
        });
    }
    public exportAsRaw() {
        const pureVisList = dumpsGWPureSpec(this.visList);
        return stringifyGWContent({
            datasets: toJS(this.commonStore.datasets),
            dataSources: this.commonStore.dataSources,
            specList: this.visSpecEncoder(pureVisList),
        });
    }
    public exportViewSpec() {
        const pureVisList = dumpsGWPureSpec(this.visList);
        return this.visSpecEncoder(pureVisList);
    }
    public importStoInfo(stoInfo: IStoInfo) {
        this.visList = parseGWPureSpec(visSpecDecoder(forwardVisualConfigs(stoInfo.specList)));
        this.visIndex = 0;
        this.commonStore.datasets = stoInfo.datasets;
        this.commonStore.dataSources = stoInfo.dataSources;
        this.commonStore.dsIndex = Math.max(stoInfo.datasets.length - 1, 0);
    }
    public importRaw(raw: string) {
        const content = parseGWContent(raw);
        this.importStoInfo(content);
    }
    
    public setGeographicData(data: IGeographicData, geoKey: string) {
        const geoJSON = data.type === 'GeoJSON' ? data.data : feature(data.data, data.objectKey || Object.keys(data.data.objects)[0]) as unknown as FeatureCollection;
        if (!('features' in geoJSON)) {
            console.error('Invalid GeoJSON: GeoJSON must be a FeatureCollection, but got', geoJSON);
            return;
        }
        this.useMutable(({ config }) => {
            config.geojson = geoJSON;
            config.geoKey = geoKey;
        });
    }
    public updateGeoKey(key: string) {
        this.useMutable(({ config }) => {
            config.geoKey = key;
        });
    }

    private visSpecEncoder(visList: IVisSpec[]): IVisSpecForExport[] {
        const updatedVisList = visList.map((visSpec) => {
            const updatedFilters = visSpec.encodings.filters.map((filter) => {
                if (filter.rule?.type === 'one of') {
                    const rule = {
                        ...filter.rule,
                        value: Array.from(filter.rule.value),
                    };
                    return {
                        ...filter,
                        rule,
                    };
                }
                return filter as IFilterFieldForExport;
            });
            return {
                ...visSpec,
                encodings: {
                    ...visSpec.encodings,
                    filters: updatedFilters,
                },
            };
        });
        return updatedVisList;
    }
    public get limit() {
        return this.visualConfig.limit;
    }

    public setLimit(value: number) {
        this.setVisualConfig('limit', value);
    }

    public get sort() {
        const { rows, columns } = this.draggableFieldState;
        if (rows.length && !rows.find((x) => x.analyticType === 'measure')) {
            return rows[rows.length - 1].sort || 'none';
        }
        if (columns.length && !columns.find((x) => x.analyticType === 'measure')) {
            return columns[columns.length - 1].sort || 'none';
        }
        return 'none';
    }

    public getWorkflow() {
        return toWorkflow(
            this.viewFilters,
            this.allFields,
            this.viewDimensions,
            this.viewMeasures,
            this.visualConfig.defaultAggregated,
            this.sort,
            this.limit > 0 ? this.limit : undefined
        );
    }

    public setComputationFunction(f: IComputationFunction, timeout = 60000) {
        this.computationFunction = withTimeout(f, timeout);
    }
}
