import { computed, makeAutoObservable, observable } from 'mobx';
import {
    VisSpecWithHistory,
    convertChart,
    exportFullRaw,
    fromFields,
    fromSnapshot,
    importFull,
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
    IVisSpecForExport,
    IGeoUrl,
    ICreateField,
    ISemanticType
} from '../interfaces';
import { GLOBAL_CONFIG } from '../config';
import { DATE_TIME_DRILL_LEVELS, DATE_TIME_FEATURE_LEVELS } from '../constants';

import { toWorkflow } from '../utils/workflow';
import { KVTuple, uniqueId } from '../models/utils';
import { encodeFilterRule } from '../utils/filter';
import { INestNode } from '../components/pivotTable/inteface';

const encodingKeys = (Object.keys(emptyEncodings) as (keyof DraggableFieldState)[]).filter((dkey) => !GLOBAL_CONFIG.META_FIELD_KEYS.includes(dkey));
const viewEncodingKeys = (geom: string) => {
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
    editingFilterIdx: number | null = null;
    meta: IMutField[];
    segmentKey: ISegmentKey = ISegmentKey.data;
    showInsightBoard: boolean = false;
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

    private onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;

    constructor(
        meta: IMutField[],
        options?: {
            empty?: boolean;
            onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;
        }
    ) {
        this.meta = meta;
        this.visList = options?.empty ? [] : [fromFields(meta, 'Chart 1')];
        this.onMetaChange = options?.onMetaChange;
        makeAutoObservable(this, {
            visList: observable.shallow,
            allEncodings: computed.struct,
            filters: observable.ref,
            tableCollapsedHeaderMap: observable.ref,
        });
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

    get viewFilters() {
        return this.currentVis.encodings.filters;
    }

    get dimensions() {
        return this.currentVis.encodings.dimensions;
    }

    get measures() {
        return this.currentVis.encodings.measures;
    }

    get rows() {
        return this.currentVis.encodings.rows;
    }

    get columns() {
        return this.currentVis.encodings.columns;
    }

    get sort() {
        const { rows, columns } = this;
        if (rows.length && !rows.find((x) => x.analyticType === 'measure')) {
            return rows[rows.length - 1].sort || 'none';
        }
        if (columns.length && !columns.find((x) => x.analyticType === 'measure')) {
            return columns[columns.length - 1].sort || 'none';
        }
        return 'none';
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
            ...(this.localGeoJSON ? {
                geoJson: this.localGeoJSON
            }: {})
        };
    }

    get allEncodings() {
        const result: Record<string, IViewField[]> = {};
        encodingKeys.forEach((k) => {
            result[k] = this.currentVis.encodings[k];
        });
        return result;
    }

    get viewEncodings() {
        const result: Record<string, IViewField[]> = {};
        viewEncodingKeys(this.config.geoms[0]).forEach((k) => {
            result[k] = this.currentVis.encodings[k];
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
        this.visList[this.visIndex] = performers.appendFilter(this.visList[this.visIndex], index, sourceKey, sourceIndex, uniqueId());
    }

    undo() {
        this.visList[this.visIndex] = undo(this.visList[this.visIndex]);
    }

    redo() {
        this.visList[this.visIndex] = redo(this.visList[this.visIndex]);
    }

    setVisName(index: number, name: string) {
        this.visList[index] = performers.setName(this.visList[index], name);
    }

    setMeta(meta: IMutField[]) {
        this.meta = meta;
    }

    resetVisualization() {
        this.visList = [fromFields(this.meta, 'Chart 1')];
    }

    addVisualization(defaultName?: string) {
        const name = defaultName || 'Chart ' + (this.visList.length + 1);
        this.visList.push(fromFields(this.meta, name));
        this.visIndex = this.visList.length - 1;
    }

    removeVisualization(index: number) {
        if (this.visLength === 1) return;
        if (this.visIndex >= index && this.visIndex > 0) this.visIndex -= 1;
        this.visList.splice(index, 1);
    }

    duplicateVisualization(index: number) {
        this.visList.push(
            fromSnapshot({
                ...this.visList[index].now,
                name: this.visList[index].now.name + ' Copy',
                visId: uniqueId(),
            })
        );
        this.visIndex = this.visList.length - 1;
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
        this.visList[this.visIndex] = performers.setConfig(this.visList[this.visIndex], ...args);
    }

    setCoordSystem(mode: ICoordMode) {
        this.visList[this.visIndex] = performers.setCoordSystem(this.visList[this.visIndex], mode);
    }

    setVisualLayout(...args: KVTuple<IVisualLayout>);
    setVisualLayout(...args: KVTuple<IVisualLayout>[]);
    setVisualLayout(...args: KVTuple<IVisualLayout> | KVTuple<IVisualLayout>[]) {
        if (typeof args[0] === 'string') {
            this.visList[this.visIndex] = performers.setLayout(this.visList[this.visIndex], [args]);
        } else {
            this.visList[this.visIndex] = performers.setLayout(this.visList[this.visIndex], args);
        }
    }

    reorderField(stateKey: keyof DraggableFieldState, sourceIndex: number, destinationIndex: number) {
        if (GLOBAL_CONFIG.META_FIELD_KEYS.includes(stateKey)) return;
        if (sourceIndex === destinationIndex) return;
        this.visList[this.visIndex] = performers.reorderField(this.visList[this.visIndex], stateKey, sourceIndex, destinationIndex);
    }

    moveField(sourceKey: keyof DraggableFieldState, sourceIndex: number, destinationKey: keyof DraggableFieldState, destinationIndex: number) {
        if (sourceKey === 'filters') {
            return this.removeField(sourceKey, sourceIndex);
        } else if (destinationKey === 'filters') {
            return this.appendFilter(destinationIndex, sourceKey, sourceIndex);
        }
        const sourceMeta = GLOBAL_CONFIG.META_FIELD_KEYS.includes(sourceKey);
        const destMeta = GLOBAL_CONFIG.META_FIELD_KEYS.includes(destinationKey);
        if (destMeta === sourceMeta) {
            this.visList[this.visIndex] = performers.moveField(this.visList[this.visIndex], sourceKey, sourceIndex, destinationKey, destinationIndex);
        } else if (destMeta) {
            this.visList[this.visIndex] = performers.removeField(this.visList[this.visIndex], sourceKey, sourceIndex);
        } else {
            this.visList[this.visIndex] = performers.cloneField(
                this.visList[this.visIndex],
                sourceKey,
                sourceIndex,
                destinationKey,
                destinationIndex,
                uniqueId()
            );
        }
    }

    modFilter(index: number, sourceKey: keyof Omit<DraggableFieldState, 'filters'>, sourceIndex: number) {
        this.visList[this.visIndex] = performers.modFilter(this.visList[this.visIndex], index, sourceKey, sourceIndex);
    }

    removeField(sourceKey: keyof DraggableFieldState, sourceIndex: number) {
        if (GLOBAL_CONFIG.META_FIELD_KEYS.includes(sourceKey)) return;
        this.visList[this.visIndex] = performers.removeField(this.visList[this.visIndex], sourceKey, sourceIndex);
    }

    writeFilter(index: number, rule: IFilterRule | null) {
        this.visList[this.visIndex] = performers.writeFilter(this.visList[this.visIndex], index, encodeFilterRule(rule));
    }

    transpose() {
        this.visList[this.visIndex] = performers.transpose(this.visList[this.visIndex]);
    }

    createBinField(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, binType: 'bin' | 'binCount', binNumber = 10): string {
        const newVarKey = uniqueId();
        const state = this.currentVis.encodings;
        const existedRelatedBinField = state.dimensions.find(
            (f) => f.computed && f.expression && f.expression.op === binType && f.expression.params[0].value === state[stateKey][index].fid && f.expression.num === binNumber
        );
        if (existedRelatedBinField) {
            return existedRelatedBinField.fid;
        }
        this.visList[this.visIndex] = performers.createBinlogField(this.visList[this.visIndex], stateKey, index, binType, newVarKey, binNumber);
        return newVarKey;
    }

    createLogField(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, scaleType: 'log10' | 'log2' | 'log', logNumber = 10) {
        this.visList[this.visIndex] = performers.createBinlogField(this.visList[this.visIndex], stateKey, index, scaleType, uniqueId(), logNumber);
    }

    public createDateTimeDrilledField(
        stateKey: keyof Omit<DraggableFieldState, 'filters'>,
        index: number,
        drillLevel: (typeof DATE_TIME_DRILL_LEVELS)[number],
        name: string,
        format: string
    ) {
        this.visList[this.visIndex] = performers.createDateDrillField(this.visList[this.visIndex], stateKey, index, drillLevel, uniqueId(), name, format);
    }

    public createDateFeatureField(
        stateKey: keyof Omit<DraggableFieldState, 'filters'>,
        index: number,
        drillLevel: (typeof DATE_TIME_FEATURE_LEVELS)[number],
        name: string,
        format: string
    ) {
        this.visList[this.visIndex] = performers.createDateFeatureField(this.visList[this.visIndex], stateKey, index, drillLevel, uniqueId(), name, format);
    }

    setFieldAggregator(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, aggName: IAggregator) {
        this.visList[this.visIndex] = performers.setFieldAggregator(this.visList[this.visIndex], stateKey, index, aggName);
    }

    applyDefaultSort(sortType: ISortMode = 'ascending') {
        this.visList[this.visIndex] = performers.applySort(this.visList[this.visIndex], sortType);
    }

    exportCurrentChart() {
        return exportFullRaw(this.visList[this.visIndex]);
    }

    exportAllCharts() {
        return this.visList.map((x) => exportFullRaw(x));
    }

    appendRaw(data: string) {
        const newChart = importFull(data);
        this.visList.push(newChart);
        this.visIndex = this.visList.length - 1;
    }

    importRaw(data: string[]) {
        this.visList = data.map(importFull);
        this.visIndex = 0;
    }

    importOld(data: IVisSpecForExport[]) {
        this.visList = visSpecDecoder(forwardVisualConfigs(data)).map(convertChart).map(fromSnapshot);
        this.visIndex = 0;
    }

    appendFromOld(data: IVisSpecForExport) {
        const newChart = fromSnapshot(convertChart(visSpecDecoder(forwardVisualConfigs([data]))[0]));
        this.visList.push(newChart);
        this.visIndex = this.visList.length - 1;
    }

    replaceNow(chart: IChart) {
        this.visList[this.visIndex] = fromSnapshot(chart);
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
            this.visList[this.visIndex] = performers.setGeoData(this.visList[this.visIndex], undefined, geoKey, geoUrl);
        } else {
            this.visList[this.visIndex] = performers.setGeoData(this.visList[this.visIndex], geoJSON, geoKey, undefined);
        }
    }

    clearGeographicData() {
        this.visList[this.visIndex] = performers.setGeoData(this.visList[this.visIndex], undefined, undefined, undefined);
    }

    changeSemanticType(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, semanticType: ISemanticType) {
        this.visList[this.visIndex] = performers.changeSemanticType(this.visList[this.visIndex], stateKey, index, semanticType);
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

    updateShowErrorResolutionPanel(errCode: number) {
        this.showErrorResolutionPanel = errCode;
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
