import { IReactionDisposer, makeAutoObservable, observable, reaction, toJS } from "mobx";
import produce from 'immer';
import { v4 as uuidv4 } from 'uuid';
import { Specification } from "visual-insights";
import { DataSet, DraggableFieldState, IFilterRule, IViewField, IVisSpec, IVisualConfig } from "../interfaces";
import { CHANNEL_LIMIT, GEMO_TYPES, MetaFieldKeys } from "../config";
import { makeBinField, makeLogField } from "../utils/normalization";
import { VisSpecWithHistory } from "../models/visSpecHistory";
import { dumpsGWPureSpec, parseGWContent, parseGWPureSpec, stringifyGWContent } from "../utils/save";
import { CommonStore } from "./commonStore";

function getChannelSizeLimit (channel: string): number {
    if (typeof CHANNEL_LIMIT[channel] === 'undefined') return Infinity;
    return CHANNEL_LIMIT[channel];
}

function geomAdapter (geom: string) {
    switch (geom) {
        case 'interval':
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
            return 'circle'
        case 'rect':
            return 'rect'
        case 'tick':
        default:
            return 'tick'
    }
}

function initEncoding(): DraggableFieldState {
    return {
        dimensions: [],
        measures: [],
        fields: [],
        rows: [],
        columns: [],
        color: [],
        opacity: [],
        size: [],
        shape: [],
        radius: [],
        theta: [],
        filters: [],
    };
}

function initVisualConfig (): IVisualConfig {
    return {
        defaultAggregated: true,
        geoms: [GEMO_TYPES[0]!],
        stack: 'stack',
        showActions: false,
        interactiveScale: false,
        sorted: 'none',
        size: {
            mode: 'auto',
            width: 320,
            height: 200
        },
        exploration: {
            mode: 'none',
            brushDirection: 'default',
        },
    }
}

type DeepReadonly<T extends Record<keyof any, any>> = {
    readonly [K in keyof T]: T[K] extends Record<keyof any, any> ? DeepReadonly<T[K]> : T[K];
};

const forwardVisualConfigs = (backwards: ReturnType<typeof parseGWContent>['specList']): IVisSpec[] => {
    return backwards.map(content => ({
        ...content,
        config: {
            ...initVisualConfig(),
            ...content.config,
        },
    }));
};


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
    private reactions: IReactionDisposer[] = []
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
    constructor (commonStore: CommonStore) {
        this.commonStore = commonStore;
        this.draggableFieldState = initEncoding();
        this.visualConfig = initVisualConfig();
        this.visList.push(new VisSpecWithHistory({
            name: ['main.tablist.autoTitle', { idx: 1 }],
            visId: uuidv4(),
            config: this.visualConfig,
            encodings: this.draggableFieldState,
        }));
        makeAutoObservable(this, {
            visList: observable.shallow,
            // @ts-expect-error private fields are not supported
            reactions: false
        });
        this.reactions.push(
            reaction(() => commonStore.currentDataset, (dataset) => {
                // this.initState();
                this.initMetaState(dataset);
            }),
            reaction(() => this.visList[this.visIndex], frame => {
                // @ts-ignore Allow assignment here to trigger watch
                this.draggableFieldState = frame.encodings;
                // @ts-ignore Allow assignment here to trigger watch
                this.visualConfig = frame.config;
                this.canUndo = frame.canUndo;
                this.canRedo = frame.canRedo;
            }),
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
    private useMutable(
        cb: (tab: {
            encodings: DraggableFieldState;
            config: IVisualConfig;
        }) => void,
    ) {
        if (this.__dangerous_is_inside_useMutable__) {
            throw new Error(
                'A recursive call of useMutable() is detected, '
                + 'this is prevented because update will be overwritten by parent execution context.'
            );
        }

        this.__dangerous_is_inside_useMutable__ = true;

        const { encodings, config } = produce({
            encodings: this.visList[this.visIndex].encodings,
            config: this.visList[this.visIndex].config,
        }, draft => { cb(draft) }); // notice that cb() may unexpectedly returns a non-nullable value
        
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
    public get viewDimensions (): IViewField[] {
        const { draggableFieldState } = this;
        const state = toJS(draggableFieldState);
        const fields: IViewField[] = [];
        (Object.keys(state) as (keyof DraggableFieldState)[])
            .filter(dkey => !MetaFieldKeys.includes(dkey))
            .forEach(dkey => {
                fields.push(...state[dkey].filter(f => f.analyticType === 'dimension'))
            })
        return fields;
    }
    /**
     * dimension fields in visualization
     */
    public get viewMeasures (): IViewField[] {
        const { draggableFieldState } = this;
        const state = toJS(draggableFieldState);
        const fields: IViewField[] = [];
        (Object.keys(state) as (keyof DraggableFieldState)[])
            .filter(dkey => !MetaFieldKeys.includes(dkey))
            .forEach(dkey => {
                fields.push(...state[dkey].filter(f => f.analyticType === 'measure'))
            })
        return fields;
    }
    public addVisualization () {
        this.visList.push(new VisSpecWithHistory({
            name: ['main.tablist.autoTitle', { idx: this.visList.length + 1 }],
            visId: uuidv4(),
            config: initVisualConfig(),
            encodings: initEncoding()
        }));
        this.visIndex = this.visList.length - 1;
    }
    public selectVisualization (visIndex: number) {
        this.visIndex = visIndex;
    }
    public setVisName (visIndex: number, name: string) {
        this.useMutable(() => {
            this.visList[visIndex].name = [name];
        });
    }
    public initState () {
        this.useMutable(tab => {
            tab.encodings = initEncoding();
            this.freezeHistory();
        });
    }
    public initMetaState (dataset: DataSet) {
        this.useMutable(({ encodings }) => {
            encodings.fields = dataset.rawFields.map((f) => ({
                dragId: uuidv4(),
                fid: f.fid,
                name: f.name || f.fid,
                aggName: f.analyticType === 'measure' ? 'sum' : undefined,
                analyticType: f.analyticType,
                semanticType: f.semanticType
            }));
            encodings.dimensions = dataset.rawFields
                .filter(f => f.analyticType === 'dimension')
                .map((f) => ({
                    dragId: uuidv4(),
                    fid: f.fid,
                    name: f.name || f.fid,
                    semanticType: f.semanticType,
                    analyticType: f.analyticType,
            }));
            encodings.measures = dataset.rawFields
                .filter(f => f.analyticType === 'measure')
                .map((f) => ({
                    dragId: uuidv4(),
                    fid: f.fid,
                    name: f.name || f.fid,
                    analyticType: f.analyticType,
                    semanticType: f.semanticType,
                    aggName: 'sum'
            }));
        });

        this.freezeHistory();
        // this.draggableFieldState.measures.push({
            //     dragId: uuidv4(),
            //     fid: COUNT_FIELD_ID,
            //     name: '记录数',
            //     analyticType: 'measure',
            //     semanticType: 'quantitative',
            //     aggName: 'count'
            // })
    }
    public clearState () {
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
                case ['defaultAggregated', 'defaultStack', 'showActions', 'interactiveScale'].includes(configKey): {
                    return (config as unknown as {[k: string]: boolean})[configKey] = Boolean(value);
                }
                case configKey === 'geoms' && Array.isArray(value):
                case configKey === 'size' && typeof value === 'object':
                case configKey === 'sorted':
                case configKey === 'stack':
                {
                    return config[configKey] = value;
                }
                default: {
                    console.error('unknown key' + configKey);
                }
            }
        });
    }
    public transformCoord (coord: 'cartesian' | 'polar') {
        if (coord === 'polar') {
            
        }
    }
    public setChartLayout(props: {mode: IVisualConfig['size']['mode'], width?: number, height?: number }) {
        this.useMutable(({ config }) => {
            const {
                mode = config.size.mode,
                width = config.size.width,
                height = config.size.height
            } = props;

            config.size.mode = mode;
            config.size.width = width;
            config.size.height = height;
        });
    }
    public setExploration(value: Partial<IVisualConfig['exploration']>) {
        this.useMutable(({ config }) => {
            if (value.mode) {
                config.exploration.mode = value.mode;
            }
            if (value.brushDirection) {
                config.exploration.brushDirection = value.brushDirection;
            }
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
            return this.appendFilter(destinationIndex, this.draggableFieldState[sourceKey][sourceIndex])
        }
        
        this.useMutable(({ encodings }) => {
            let movingField: IViewField;
            // 来源是不是metafield，是->clone；不是->直接删掉
            if (MetaFieldKeys.includes(sourceKey)) {
                // use a different dragId
                movingField = {
                    ...toJS(encodings[sourceKey][sourceIndex]), // toJS will NOT shallow copy a object here
                    dragId: uuidv4(),
                };
            } else {
                [movingField] = encodings[sourceKey].splice(sourceIndex, 1);
            }
            // 目的地是metafields的情况，只有在来源也是metafields时，会执行字段类型转化操作
            if (MetaFieldKeys.includes(destinationKey)) {
                if (!MetaFieldKeys.includes(sourceKey))return;
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
        if (MetaFieldKeys.includes(sourceKey))return;

        this.useMutable(({ encodings }) => {
            const fields = encodings[sourceKey];
            fields.splice(sourceIndex, 1);
        });
    }
    private appendFilter(index: number, data: IViewField) {
        this.useMutable(({ encodings }) => {
            encodings.filters.splice(index, 0, {
                ...toJS(data),
                dragId: uuidv4(),
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
            encodings.rows = fieldsInCup as typeof encodings.rows;  // assume this as writable
        });
    }
    public createBinField(stateKey: keyof DraggableFieldState, index: number) {
        this.useMutable(({ encodings }) => {
            const originField = encodings[stateKey][index]
            const binField: IViewField = {
                fid: uuidv4(),
                dragId: uuidv4(),
                name: `bin(${originField.name})`,
                semanticType: 'ordinal',
                analyticType: 'dimension',
            };
            encodings.dimensions.push(binField);
            this.commonStore.currentDataset.dataSource = makeBinField(this.commonStore.currentDataset.dataSource, originField.fid, binField.fid)
        });
    }
    public createLogField(stateKey: keyof DraggableFieldState, index: number) {
        if (stateKey === 'filters') {
            return;
        }

        this.useMutable(({ encodings }) => {
            const originField = encodings[stateKey][index];
            const logField: IViewField = {
                fid: uuidv4(),
                dragId: uuidv4(),
                name: `log10(${originField.name})`,
                semanticType: 'quantitative',
                analyticType: originField.analyticType
            };
            encodings[stateKey].push(logField);
            this.commonStore.currentDataset.dataSource = makeLogField(this.commonStore.currentDataset.dataSource, originField.fid, logField.fid)
        });
    }
    public setFieldAggregator (stateKey: keyof DraggableFieldState, index: number, aggName: string) {
        this.useMutable(({ encodings }) => {
            const fields = encodings[stateKey];

            if (fields[index]) {
                encodings[stateKey][index].aggName = aggName;
            }
        });
    }
    public get sortCondition () {
        const { rows, columns } = this.draggableFieldState;
        const yField = rows.length > 0 ? rows[rows.length - 1] : null;
        const xField = columns.length > 0 ? columns[columns.length - 1] : null;
        if (xField !== null && xField.analyticType === 'dimension' && yField !== null && yField.analyticType === 'measure') {
            return true
        }
        if (xField !== null && xField.analyticType === 'measure' && yField !== null && yField.analyticType === 'dimension') {
            return true
        }
        return false;
    }
    public setFieldSort (stateKey: keyof DraggableFieldState, index: number, sortType: 'none' | 'ascending' | 'descending') {
        this.useMutable(({ encodings }) => {
            encodings[stateKey][index].sort = sortType;
        });
    }
    public applyDefaultSort(sortType: 'none' | 'ascending' | 'descending' = 'ascending') {
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
    public appendField (destinationKey: keyof DraggableFieldState, field: IViewField | undefined) {
        if (MetaFieldKeys.includes(destinationKey)) return;
        if (typeof field === 'undefined') return;
        if (destinationKey === 'filters') {
            return;
        }
        
        
        this.useMutable(({ encodings }) => {
            const cloneField = { ...toJS(field) };
            cloneField.dragId = uuidv4();
            encodings[destinationKey].push(cloneField);
        });
    }
    public renderSpec (spec: Specification) {
        const tab = this.visList[this.visIndex];

        if (tab) {
            const fields = tab.encodings.fields;
            // thi
            // const [xField, yField, ] = spec.position;
            this.clearState();
            if ((spec.geomType?.length ?? 0) > 0) {
                this.setVisualConfig('geoms', spec.geomType!.map(g => geomAdapter(g)));
            }
            if ((spec.facets?.length ?? 0) > 0) {
                const facets = (spec.facets || []).concat(spec.highFacets || []);
                for (let facet of facets) {
                    this.appendField('rows', fields.find(f => f.fid === facet));
                }
            }
            if (spec.position) {
                const [cols, rows] = spec.position;
                if (cols) this.appendField('columns', fields.find(f => f.fid === cols));
                if (rows) this.appendField('rows', fields.find(f => f.fid === rows));
            }
            if ((spec.color?.length ?? 0) > 0) {
                this.appendField('color', fields.find(f => f.fid === spec.color![0]));
            }
            if ((spec.size?.length ?? 0) > 0) {
                this.appendField('size', fields.find(f => f.fid === spec.size![0]));
            }
            if ((spec.opacity?.length ?? 0) > 0) {
                this.appendField('opacity', fields.find(f => f.fid === spec.opacity![0]));
            }
        }
    }
    public destroy () {
        this.reactions.forEach(rec => {
            rec();
        })
    }
    public exportAsRaw () {
        const pureVisList = dumpsGWPureSpec(this.visList);
        return stringifyGWContent({
            datasets: toJS(this.commonStore.datasets),
            dataSources: this.commonStore.dataSources,
            specList: pureVisList
        })
    }
    public importRaw (raw: string) {
        const content = parseGWContent(raw);
        this.commonStore.datasets = content.datasets;
        this.commonStore.dataSources = content.dataSources;
        this.commonStore.dsIndex = Math.max(content.datasets.length - 1, 0);
        // 补上初始化新版本特性
        this.visList = parseGWPureSpec(forwardVisualConfigs(content.specList));
        this.visIndex = 0;
    }
}