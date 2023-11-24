import { computed, makeAutoObservable, observable } from 'mobx';
import {
    VisSpecWithHistory,
    convertChart,
    exportFullRaw,
    exportNow,
    fromFields,
    fromSnapshot,
    importFull,
    importNow,
    newChart,
    performers,
    redo,
    undo,
} from '../models/visSpecHistory';
import { emptyEncodings, forwardVisualConfigs, visSpecDecoder } from '../utils/save';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import {
    DraggableFieldState,
    Filters,
    IAggregator,
    IChart,
    IFilterRule,
    IMutField,
    ISegmentKey,
    IGeographicData,
    ISortMode,
    IViewField,
    IVisSpec,
    IVisualConfigNew,
    IVisualLayout,
    Specification,
    ICoordMode,
    IGeoUrl,
    ICreateField,
    ISemanticType,
    ISpecChange,
} from '../interfaces';
import { GLOBAL_CONFIG } from '../config';
import { COUNT_FIELD_ID, DATE_TIME_DRILL_LEVELS, DATE_TIME_FEATURE_LEVELS, MEA_KEY_ID, MEA_VAL_ID } from '../constants';

import { toWorkflow } from '../utils/workflow';
import { KVTuple, uniqueId } from '../models/utils';
import { INestNode } from '../components/pivotTable/inteface';
import { getSort, getSortedEncoding } from '../utils';

const encodingKeys = (Object.keys(emptyEncodings) as (keyof DraggableFieldState)[]).filter((dkey) => !GLOBAL_CONFIG.META_FIELD_KEYS.includes(dkey));
export const viewEncodingKeys = (geom: string) => {
    switch (geom) {
        case 'choropleth':
            return ['geoId', 'color', 'opacity', 'text', 'details'];
        case 'poi':
            return ['longitude', 'latitude', 'color', 'opacity', 'size', 'details'];
        case 'arc':
            return ['radius', 'theta', 'color', 'opacity', 'size', 'details', 'text'];
        case 'bar':
        case 'tick':
        case 'line':
        case 'area':
        case 'boxplot':
            return ['columns', 'rows', 'color', 'opacity', 'size', 'details', 'text'];
        case 'text':
            return ['columns', 'rows', 'color', 'opacity', 'size', 'text'];
        case 'table':
            return ['columns', 'rows'];
        default:
            return ['columns', 'rows', 'color', 'opacity', 'size', 'details', 'shape'];
    }
};

export class VizSpecStore {
    visList: VisSpecWithHistory[];
    visIndex: number = 0;
    createdVis: number = 0;
    editingFilterIdx: number | null = null;
    meta: IMutField[];
    segmentKey: ISegmentKey = ISegmentKey.vis;
    showInsightBoard: boolean = false;
    showDataBoard: boolean = false;
    vizEmbededMenu: { show: boolean; position: [number, number] } = { show: false, position: [0, 0] };
    showDataConfig: boolean = false;
    showCodeExportPanel: boolean = false;
    showVisualConfigPanel: boolean = false;
    showGeoJSONConfigPanel: boolean = false;
    removeConfirmIdx: number | null = null;
    filters: Filters = {};
    tableCollapsedHeaderMap: Map<string, INestNode['path']> = new Map();
    selectedMarkObject: Record<string, string | number | undefined> = {};
    showLogSettingPanel: boolean = false;
    showBinSettingPanel: boolean = false;
    createField: ICreateField | undefined = undefined;
    localGeoJSON: FeatureCollection | undefined = undefined;
    showErrorResolutionPanel: number = 0;
    lastErrorMessage: string = '';
    showAskvizFeedbackIndex: number | undefined = 0;

    private onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;
    private onSpecChange?: (change: ISpecChange) => void;

    setOnMetaChange(f?: (fid: string, diffMeta: Partial<IMutField>) => void) {
        this.onMetaChange = f;
    }
    setOnSpecChange(f?: (change: ISpecChange) => void) {
        this.onSpecChange = f;
    }
    constructor(
        meta: IMutField[],
        options?: {
            empty?: boolean;
            onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;
            onSpecChange?: (change: ISpecChange) => void;
        }
    ) {
        this.meta = meta;
        this.visList = options?.empty ? [] : [fromFields(meta, 'Chart 1')];
        this.createdVis = this.visList.length;
        this.onMetaChange = options?.onMetaChange;
        this.onSpecChange = options?.onSpecChange;
        makeAutoObservable(this, {
            visList: observable.shallow,
            allEncodings: computed.struct,
            filters: observable.ref,
            tableCollapsedHeaderMap: observable.ref,
        });
    }

    private mutVisSpec(index: number, f: (spec: VisSpecWithHistory) => VisSpecWithHistory) {
        this.visList[index] = f(this.visList[index]);
        this.onSpecChange?.({
            index,
            spec: this.visList[index].now,
            type: 'replace',
        });
    }

    private mutCurrentVisSpec(f: (spec: VisSpecWithHistory) => VisSpecWithHistory) {
        this.mutVisSpec(this.visIndex, f);
    }

    get visLength() {
        return this.visList.length;
    }

    get vizList() {
        return this.visList.map((x) => x.now);
    }

    get currentVis() {
        return this.visList[this.visIndex].now;
    }

    get currentEncodings() {
        return this.currentVis.encodings;
    }

    get viewFilters() {
        return this.currentEncodings.filters;
    }

    get dimensions() {
        return this.currentEncodings.dimensions;
    }

    get measures() {
        return this.currentEncodings.measures;
    }

    get rows() {
        return this.currentEncodings.rows;
    }

    get columns() {
        return this.currentEncodings.columns;
    }

    get sort() {
        return getSort({ columns: this.columns, rows: this.rows });
    }

    get sortedEncoding() {
        return getSortedEncoding({ columns: this.columns, rows: this.rows });
    }

    get allFields() {
        return [...this.dimensions, ...this.measures];
    }

    get config() {
        return this.currentVis.config;
    }

    get layout() {
        return {
            ...this.currentVis.layout,
            ...(this.localGeoJSON
                ? {
                      geoJson: this.localGeoJSON,
                  }
                : {}),
        };
    }

    get allEncodings() {
        const result: Record<string, IViewField[]> = {};
        encodingKeys.forEach((k) => {
            result[k] = this.currentEncodings[k];
        });
        return result;
    }

    get viewEncodings() {
        const result: Record<string, IViewField[]> = {};
        viewEncodingKeys(this.config.geoms[0]).forEach((k) => {
            result[k] = this.currentEncodings[k];
        });
        return result;
    }

    get viewEncodingFields() {
        return viewEncodingKeys(this.config.geoms[0]).flatMap((k) => this.viewEncodings[k]);
    }

    get viewDimensions() {
        return this.viewEncodingFields.filter((x) => x.analyticType === 'dimension');
    }

    get viewMeasures() {
        return this.viewEncodingFields.filter((x) => x.analyticType === 'measure');
    }

    get workflow() {
        return toWorkflow(
            this.viewFilters,
            this.allFields,
            this.viewDimensions,
            this.viewMeasures,
            this.config.defaultAggregated,
            this.sort,
            this.config.folds,
            this.config.limit
        );
    }

    get limit() {
        return this.config.limit;
    }

    get canUndo() {
        return this.visList[this.visIndex].cursor > 0;
    }

    get canRedo() {
        const viz = this.visList[this.visIndex];
        return viz.cursor !== viz.timeline.length;
    }

    private appendFilter(index: number, sourceKey: keyof Omit<DraggableFieldState, 'filters'>, sourceIndex: number) {
        const oriF = this.currentEncodings[sourceKey][sourceIndex];
        if (oriF.fid === MEA_KEY_ID || oriF.fid === MEA_VAL_ID || oriF.fid === COUNT_FIELD_ID) {
            return;
        }
        this.mutCurrentVisSpec((x) => performers.appendFilter(x, index, sourceKey, sourceIndex, uniqueId()));
        this.editingFilterIdx = index;
    }

    undo() {
        this.mutCurrentVisSpec(undo);
    }

    redo() {
        this.mutCurrentVisSpec(redo);
    }

    setVisName(index: number, name: string) {
        this.mutVisSpec(index, (x) => performers.setName(x, name));
    }

    setMeta(meta: IMutField[]) {
        this.meta = meta;
    }

    resetVisualization(name = 'Chart 1') {
        this.visList = [fromFields(this.meta, name)];
        this.createdVis = 1;
        this.onSpecChange?.({ type: 'reset', specs: this.visList.map((x) => x.now) });
    }

    addVisualization(defaultName?: string | ((index: number) => string)) {
        const name = defaultName ? (typeof defaultName === 'function' ? defaultName(this.createdVis + 1) : defaultName) : 'Chart ' + (this.createdVis + 1);
        this.visList.push(fromFields(this.meta, name));
        this.createdVis += 1;
        this.visIndex = this.visList.length - 1;
        this.onSpecChange?.({ type: 'insert', index: this.visIndex, spec: this.visList[this.visIndex].now });
    }

    removeVisualization(index: number) {
        if (this.visLength === 1) return;
        if (this.visIndex >= index && this.visIndex > 0) this.visIndex -= 1;
        this.visList.splice(index, 1);
        this.onSpecChange?.({ type: 'remove', index });
    }

    duplicateVisualization(index: number) {
        this.visList.push(
            fromSnapshot({
                ...this.visList[index].now,
                name: this.visList[index].now.name + ' Copy',
                visId: uniqueId(),
            })
        );
        this.createdVis += 1;
        this.visIndex = this.visList.length - 1;
        this.onSpecChange?.({ type: 'insert', index: this.visIndex, spec: this.visList[this.visIndex].now });
    }

    setFilterEditing(index: number) {
        this.editingFilterIdx = index;
    }

    closeFilterEditing() {
        this.editingFilterIdx = null;
    }

    setSegmentKey(sk: ISegmentKey) {
        this.segmentKey = sk;
    }

    setVisualConfig(...args: KVTuple<IVisualConfigNew>) {
        this.mutCurrentVisSpec((v) => performers.setConfig(v, ...args));
    }

    setCoordSystem(mode: ICoordMode) {
        this.mutCurrentVisSpec((v) => performers.setCoordSystem(v, mode));
    }

    setVisualLayout(...args: KVTuple<IVisualLayout>);
    setVisualLayout(...args: KVTuple<IVisualLayout>[]);
    setVisualLayout(...args: KVTuple<IVisualLayout> | KVTuple<IVisualLayout>[]) {
        if (typeof args[0] === 'string') {
            this.mutCurrentVisSpec((v) => performers.setLayout(v, [args]));
        } else {
            this.mutCurrentVisSpec((v) => performers.setLayout(v, args));
        }
    }

    reorderField(stateKey: keyof DraggableFieldState, sourceIndex: number, destinationIndex: number) {
        if (GLOBAL_CONFIG.META_FIELD_KEYS.includes(stateKey)) return;
        if (sourceIndex === destinationIndex) return;
        this.mutCurrentVisSpec((v) => performers.reorderField(v, stateKey, sourceIndex, destinationIndex));
    }

    moveField(sourceKey: keyof DraggableFieldState, sourceIndex: number, destinationKey: keyof DraggableFieldState, destinationIndex: number) {
        if (sourceKey === 'filters') {
            return this.removeField(sourceKey, sourceIndex);
        } else if (destinationKey === 'filters') {
            return this.appendFilter(destinationIndex, sourceKey, sourceIndex);
        }
        const oriF = this.currentEncodings[sourceKey][sourceIndex];
        const sourceMeta = GLOBAL_CONFIG.META_FIELD_KEYS.includes(sourceKey);
        const destMeta = GLOBAL_CONFIG.META_FIELD_KEYS.includes(destinationKey);
        if (sourceMeta && destMeta && (oriF.fid === MEA_KEY_ID || oriF.fid === MEA_VAL_ID || oriF.fid === COUNT_FIELD_ID)) {
            return;
        }
        const limit = GLOBAL_CONFIG.CHANNEL_LIMIT[destinationKey] ?? Infinity;
        if (destMeta === sourceMeta) {
            this.mutCurrentVisSpec((v) => performers.moveField(v, sourceKey, sourceIndex, destinationKey, destinationIndex, limit));
        } else if (destMeta) {
            this.mutCurrentVisSpec((v) => performers.removeField(v, sourceKey, sourceIndex));
        } else {
            this.mutCurrentVisSpec((v) => performers.cloneField(v, sourceKey, sourceIndex, destinationKey, destinationIndex, uniqueId(), limit));
        }
    }

    modFilter(index: number, sourceKey: keyof Omit<DraggableFieldState, 'filters'>, sourceIndex: number) {
        this.mutCurrentVisSpec((v) => performers.modFilter(v, index, sourceKey, sourceIndex));
    }

    removeField(sourceKey: keyof DraggableFieldState, sourceIndex: number) {
        if (GLOBAL_CONFIG.META_FIELD_KEYS.includes(sourceKey)) return;
        this.mutCurrentVisSpec((v) => performers.removeField(v, sourceKey, sourceIndex));
    }

    writeFilter(index: number, rule: IFilterRule | null) {
        this.mutCurrentVisSpec((v) => performers.writeFilter(v, index, rule));
    }

    transpose() {
        this.mutCurrentVisSpec((v) => performers.transpose(v));
    }

    createBinField(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, binType: 'bin' | 'binCount', binNumber = 10): string {
        const newVarKey = uniqueId();
        const state = this.currentEncodings;
        const existedRelatedBinField = state.dimensions.find(
            (f) =>
                f.computed &&
                f.expression &&
                f.expression.op === binType &&
                f.expression.params[0].value === state[stateKey][index].fid &&
                f.expression.num === binNumber
        );
        if (existedRelatedBinField) {
            return existedRelatedBinField.fid;
        }
        this.mutCurrentVisSpec((v) => performers.createBinlogField(v, stateKey, index, binType, newVarKey, binNumber));
        return newVarKey;
    }

    createLogField(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, scaleType: 'log10' | 'log2' | 'log', logNumber = 10) {
        this.mutCurrentVisSpec((v) => performers.createBinlogField(v, stateKey, index, scaleType, uniqueId(), logNumber));
    }

    public createDateTimeDrilledField(
        stateKey: keyof Omit<DraggableFieldState, 'filters'>,
        index: number,
        drillLevel: (typeof DATE_TIME_DRILL_LEVELS)[number],
        name: string,
        format: string,
        offset: number
    ) {
        this.mutCurrentVisSpec((v) => performers.createDateDrillField(v, stateKey, index, drillLevel, uniqueId(), name, format, offset));
    }

    public createDateFeatureField(
        stateKey: keyof Omit<DraggableFieldState, 'filters'>,
        index: number,
        drillLevel: (typeof DATE_TIME_FEATURE_LEVELS)[number],
        name: string,
        format: string,
        offset: number
    ) {
        this.mutCurrentVisSpec((v) => performers.createDateFeatureField(v, stateKey, index, drillLevel, uniqueId(), name, format, offset));
    }

    setFieldAggregator(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, aggName: IAggregator) {
        this.mutCurrentVisSpec((v) => performers.setFieldAggregator(v, stateKey, index, aggName));
    }

    setFilterAggregator(index: number, aggName: IAggregator | '') {
        this.mutCurrentVisSpec((v) => performers.setFilterAggregator(v, index, aggName));
    }

    applyDefaultSort(sortType: ISortMode = 'ascending') {
        this.mutCurrentVisSpec((v) => performers.applySort(v, sortType));
    }

    exportCurrentChart() {
        return exportFullRaw(this.visList[this.visIndex]);
    }

    exportAllCharts() {
        return this.visList.map((x) => exportFullRaw(x));
    }

    exportCode() {
        return this.visList.map((x) => exportNow(x));
    }

    importCode(data: IChart[] | IVisSpec[]) {
        this.visList = data.map((x: IChart | IVisSpec) => {
            if ('layout' in x) {
                return importNow(x);
            } else {
                return fromSnapshot(convertChart(visSpecDecoder(forwardVisualConfigs(x))));
            }
        });
        this.createdVis = this.visList.length;
        this.visIndex = 0;
        this.onSpecChange?.({ type: 'reset', specs: this.visList.map((x) => x.now) });
    }

    appendRaw(data: string) {
        const newChart = importFull(data);
        this.visList.push(newChart);
        this.createdVis += 1;
        this.visIndex = this.visList.length - 1;
        this.onSpecChange?.({ type: 'insert', index: this.visIndex, spec: this.visList[this.visIndex].now });
    }

    importRaw(data: string[]) {
        this.visList = data.map(importFull);
        this.createdVis = this.visList.length;
        this.visIndex = 0;
        this.onSpecChange?.({ type: 'reset', specs: this.visList.map((x) => x.now) });
    }

    appendFromCode(data: IVisSpec | IChart) {
        const newChart = 'layout' in data ? importNow(data) : fromSnapshot(convertChart(visSpecDecoder(forwardVisualConfigs(data))));
        this.visList.push(newChart);
        this.createdVis += 1;
        this.visIndex = this.visList.length - 1;
        this.onSpecChange?.({ type: 'insert', index: this.visIndex, spec: this.visList[this.visIndex].now });
    }

    setAskvizFeedback(show: boolean) {
        this.showAskvizFeedbackIndex = show ? this.visIndex : undefined;
    }

    replaceNow(chart: IChart) {
        this.visList[this.visIndex] = fromSnapshot(chart);
        this.onSpecChange?.({
            index: this.visIndex,
            spec: chart,
            type: 'replace',
        });
    }

    selectVisualization(index: number) {
        this.visIndex = index;
    }

    setShowDataConfig(show: boolean) {
        this.showDataConfig = show;
    }
    setShowInsightBoard(show: boolean) {
        this.showInsightBoard = show;
    }
    setShowDataBoard(show: boolean) {
        this.showDataBoard = show;
    }
    showEmbededMenu(position: [number, number]) {
        this.vizEmbededMenu.show = true;
        this.vizEmbededMenu.position = position;
    }
    setShowCodeExportPanel(show: boolean) {
        this.showCodeExportPanel = show;
    }
    setShowVisualConfigPanel(show: boolean) {
        this.showVisualConfigPanel = show;
    }
    closeEmbededMenu() {
        this.vizEmbededMenu.show = false;
    }
    setFilters(props: Filters) {
        this.filters = props;
    }

    updateCurrentDatasetMetas(fid: string, diffMeta: Partial<IMutField>) {
        const field = this.meta.find((f) => f.fid === fid);
        if (field) {
            for (let mk in diffMeta) {
                field[mk] = diffMeta[mk];
            }
        }
        this.onMetaChange?.(fid, diffMeta);
    }

    openRemoveConfirmModal(index: number) {
        this.removeConfirmIdx = index;
    }

    closeRemoveConfirmModal() {
        this.removeConfirmIdx = null;
    }

    setGeographicData(data: IGeographicData, geoKey: string, geoUrl?: IGeoUrl) {
        const geoJSON =
            data.type === 'GeoJSON' ? data.data : (feature(data.data, data.objectKey || Object.keys(data.data.objects)[0]) as unknown as FeatureCollection);
        if (!('features' in geoJSON)) {
            console.error('Invalid GeoJSON: GeoJSON must be a FeatureCollection, but got', geoJSON);
            return;
        }
        this.localGeoJSON = geoJSON;
        if (geoUrl) {
            this.mutCurrentVisSpec((v) => performers.setGeoData(v, undefined, geoKey, geoUrl));
        } else {
            this.mutCurrentVisSpec((v) => performers.setGeoData(v, geoJSON, geoKey, undefined));
        }
    }

    clearGeographicData() {
        this.mutCurrentVisSpec((v) => performers.setGeoData(v, undefined, undefined, undefined));
    }

    changeSemanticType(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, semanticType: ISemanticType) {
        this.mutCurrentVisSpec((v) => performers.changeSemanticType(v, stateKey, index, semanticType));
    }

    updateGeoKey(key: string) {
        this.setVisualLayout('geoKey', key);
    }

    updateTableCollapsedHeader(node: INestNode) {
        const { uniqueKey, height } = node;
        if (height < 1) return;
        const updatedMap = new Map(this.tableCollapsedHeaderMap);
        // if some child nodes of the incoming node are collapsed, remove them first
        updatedMap.forEach((existingPath, existingKey) => {
            if (existingKey.startsWith(uniqueKey) && existingKey.length > uniqueKey.length) {
                updatedMap.delete(existingKey);
            }
        });
        if (!updatedMap.has(uniqueKey)) {
            updatedMap.set(uniqueKey, node.path);
        } else {
            updatedMap.delete(uniqueKey);
        }
        this.tableCollapsedHeaderMap = updatedMap;
    }

    resetTableCollapsedHeader() {
        const updatedMap: Map<string, INestNode['path']> = new Map();
        this.tableCollapsedHeaderMap = updatedMap;
    }

    setShowGeoJSONConfigPanel(show: boolean) {
        this.showGeoJSONConfigPanel = show;
    }

    setShowBinSettingPanel(show: boolean) {
        this.showBinSettingPanel = show;
    }

    setShowLogSettingPanel(show: boolean) {
        this.showLogSettingPanel = show;
    }

    setCreateField(field: ICreateField) {
        this.createField = field;
    }

    updateSelectedMarkObject(newMarkObj: Record<string, string | number | undefined>) {
        this.selectedMarkObject = newMarkObj;
    }

    updateShowErrorResolutionPanel(errCode: number, msg = '') {
        this.showErrorResolutionPanel = errCode;
        this.lastErrorMessage = msg;
    }
}

export function renderSpec(spec: Specification, meta: IMutField[], name: string, visId: string) {
    const chart = newChart(meta, name, visId);
    const fields = chart.encodings.dimensions.concat(chart.encodings.measures);
    chart.config.defaultAggregated = Boolean(spec.aggregate);
    if ((spec.geomType?.length ?? 0) > 0) {
        chart.config.geoms = spec.geomType?.map((g) => geomAdapter(g)) ?? ['tick'];
    }
    if ((spec.facets?.length ?? 0) > 0) {
        const facets = (spec.facets || []).concat(spec.highFacets || []);
        for (let facet of facets) {
            const f = fields.find((f) => f.fid === facet);
            f && chart.encodings.rows.push(f);
        }
    }
    if (spec.position) {
        const [cols, rows] = spec.position;
        if (cols) {
            const f = fields.find((f) => f.fid === cols);
            f && chart.encodings.columns.push(f);
        }
        if (rows) {
            const f = fields.find((f) => f.fid === rows);
            f && chart.encodings.rows.push(f);
        }
    }
    if (spec.color && spec.color.length > 0) {
        const color = spec.color[0];
        const f = fields.find((f) => f.fid === color);
        f && chart.encodings.color.push(f);
    }
    if (spec.size && spec.size.length > 0) {
        const size = spec.size[0];
        const f = fields.find((f) => f.fid === size);
        f && chart.encodings.size.push(f);
    }
    if (spec.opacity && spec.opacity.length > 0) {
        const opacity = spec.opacity[0];
        const f = fields.find((f) => f.fid === opacity);
        f && chart.encodings.opacity.push(f);
    }
    return chart;
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
