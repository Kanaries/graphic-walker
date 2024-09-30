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
    parseChart,
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
    IPaintMap,
    IPaintMapV2,
    IDefaultConfig,
    FieldIdentifier,
} from '../interfaces';
import { GLOBAL_CONFIG } from '../config';
import { COUNT_FIELD_ID, DATE_TIME_DRILL_LEVELS, DATE_TIME_FEATURE_LEVELS, PAINT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../constants';

import { toWorkflow } from '../utils/workflow';
import { KVTuple, uniqueId } from '../models/utils';
import { INestNode } from '../components/pivotTable/inteface';
import { getSort, getSortedEncoding } from '../utils';
import { getSQLItemAnalyticType, parseSQLExpr } from '../lib/sql';
import { IPaintMapAdapter } from '../lib/paint';
import { toChatMessage } from '@/models/chat';
import { viewEncodingKeys } from '@/models/visSpec';
import { getAllFields, getViewEncodingFields } from './storeStateLib';

const encodingKeys = (Object.keys(emptyEncodings) as (keyof DraggableFieldState)[]).filter((dkey) => !GLOBAL_CONFIG.META_FIELD_KEYS.includes(dkey));
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
    showRenamePanel: boolean = false;
    createField: ICreateField | undefined = undefined;
    localGeoJSON: FeatureCollection | undefined = undefined;
    showErrorResolutionPanel: number = 0;
    showPainterPanel: boolean = false;
    lastErrorMessage: string = '';
    showAskvizFeedbackIndex: number | undefined = 0;
    lastSpec: string = '';
    editingComputedFieldFid: string | undefined = undefined;
    defaultConfig: IDefaultConfig | undefined;

    onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;

    constructor(
        meta: IMutField[],
        options?: {
            empty?: boolean;
            onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;
            defaultConfig?: IDefaultConfig;
        }
    ) {
        this.meta = meta;
        this.visList = options?.empty ? [] : [fromFields(meta, 'Chart 1', options?.defaultConfig)];
        this.createdVis = this.visList.length;
        this.defaultConfig = options?.defaultConfig;
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
        return getAllFields(this);
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

    get viewEncodings(): Partial<Omit<DraggableFieldState, 'filters'>> {
        const result: Record<string, IViewField[]> = {};
        viewEncodingKeys(this.config.geoms[0]).forEach((k) => {
            result[k] = this.currentEncodings[k];
        });
        return result;
    }

    get viewEncodingFields() {
        return getViewEncodingFields(this.viewEncodings, this.config.geoms[0]);
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
            this.config.limit,
            this.config.timezoneDisplayOffset
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

    get chatMessages() {
        return toChatMessage(this.visList[this.visIndex]);
    }

    get paintFields() {
        if (!this.currentVis.config.defaultAggregated) {
            const { columns, rows } = this.currentEncodings;
            if (columns.length !== 1 || rows.length !== 1) {
                return { type: 'error', key: 'count' } as const;
            }
            const col = columns[0];
            const row = rows[0];
            // range on temporal need use a temporal Domain, which is not impemented
            if (col.semanticType === 'temporal' || row.semanticType === 'temporal') {
                return { type: 'error', key: 'temporal' } as const;
            }
            if (
                col.aggName === 'expr' ||
                row.aggName === 'expr' ||
                col.fid === MEA_KEY_ID ||
                col.fid === MEA_VAL_ID ||
                row.fid === MEA_KEY_ID ||
                row.fid === MEA_VAL_ID ||
                col.fid === PAINT_FIELD_ID ||
                row.fid === PAINT_FIELD_ID
            ) {
                return { type: 'error', key: 'count' } as const;
            }
            return {
                type: 'new',
                x: col,
                y: row,
            } as const;
        } else {
            const { columns, rows, color, shape, size, opacity } = this.currentEncodings;
            if (columns.length !== 1 || rows.length !== 1) {
                return { type: 'error', key: 'count' } as const;
            }
            const col = columns[0];
            const row = rows[0];
            if (
                col.aggName === 'expr' ||
                row.aggName === 'expr' ||
                col.fid === MEA_KEY_ID ||
                col.fid === MEA_VAL_ID ||
                row.fid === MEA_KEY_ID ||
                row.fid === MEA_VAL_ID ||
                col.fid === PAINT_FIELD_ID ||
                row.fid === PAINT_FIELD_ID
            ) {
                return { type: 'error', key: 'count' } as const;
            }
            const guard = (f?: IViewField) => (f?.fid === PAINT_FIELD_ID ? undefined : f);
            if (col.analyticType === 'dimension' && row.analyticType === 'dimension') {
                return {
                    type: 'new',
                    x: col,
                    y: row,
                } as const;
            }
            return {
                type: 'agg',
                x: col,
                y: row,
                color: guard(color[0]),
                shape: guard(shape[0]),
                size: guard(size[0]),
                opacity: guard(opacity[0]),
            } as const;
        }
    }

    get paintInfo() {
        const existPaintField = this.currentEncodings.dimensions.find((x) => x.fid === PAINT_FIELD_ID);
        if (existPaintField) {
            const param = existPaintField.expression?.params.find((x) => x.type === 'map')?.value;
            if (param) {
                return {
                    type: 'exist',
                    item: IPaintMapAdapter(param),
                    new: this.paintFields,
                } as const;
            }
            const paramV2 = existPaintField.expression?.params.find((x) => x.type === 'newmap')?.value;
            if (paramV2) {
                return {
                    type: 'exist',
                    item: paramV2,
                    new: this.paintFields,
                } as const;
            }
        }
        return this.paintFields;
    }

    private appendFilter(index: number, sourceKey: keyof Omit<DraggableFieldState, 'filters'>, sourceIndex: number) {
        const oriF = this.currentEncodings[sourceKey][sourceIndex];
        if (oriF.fid === MEA_KEY_ID || oriF.fid === MEA_VAL_ID || oriF.fid === COUNT_FIELD_ID || oriF.aggName === 'expr') {
            return;
        }
        this.visList[this.visIndex] = performers.appendFilter(this.visList[this.visIndex], index, sourceKey, sourceIndex, null);
        this.editingFilterIdx = index;
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

    setOnMetaChange(onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void) {
        this.onMetaChange = onMetaChange;
    }

    setDefaultConfig(defaultConfig?: IDefaultConfig) {
        this.defaultConfig = defaultConfig;
    }

    resetVisualization(name = 'Chart 1') {
        this.visList = [fromFields(this.meta, name, this.defaultConfig)];
        this.createdVis = 1;
    }

    addVisualization(defaultName?: string | ((index: number) => string)) {
        const name = defaultName ? (typeof defaultName === 'function' ? defaultName(this.createdVis + 1) : defaultName) : 'Chart ' + (this.createdVis + 1);
        this.visList.push(fromFields(this.meta, name, this.defaultConfig));
        this.createdVis += 1;
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
        this.createdVis += 1;
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
        const oriF = this.currentEncodings[sourceKey][sourceIndex];
        const sourceMeta = GLOBAL_CONFIG.META_FIELD_KEYS.includes(sourceKey);
        const destMeta = GLOBAL_CONFIG.META_FIELD_KEYS.includes(destinationKey);
        if (sourceMeta && destMeta && (oriF.fid === MEA_KEY_ID || oriF.fid === MEA_VAL_ID || oriF.fid === COUNT_FIELD_ID || oriF.fid === PAINT_FIELD_ID)) {
            return;
        }
        const limit = GLOBAL_CONFIG.CHANNEL_LIMIT[destinationKey] ?? Infinity;
        if (destMeta === sourceMeta) {
            this.visList[this.visIndex] = performers.moveField(this.visList[this.visIndex], sourceKey, sourceIndex, destinationKey, destinationIndex, limit);
        } else if (destMeta) {
            this.visList[this.visIndex] = performers.removeField(this.visList[this.visIndex], sourceKey, sourceIndex);
        } else {
            // add an encoding
            if (oriF.fid === MEA_KEY_ID || oriF.fid === MEA_VAL_ID) {
                this.visList[this.visIndex] = performers.addFoldField(
                    this.visList[this.visIndex],
                    sourceKey,
                    sourceIndex,
                    destinationKey,
                    destinationIndex,
                    uniqueId(),
                    limit
                );
                return;
            }
            this.visList[this.visIndex] = performers.cloneField(
                this.visList[this.visIndex],
                sourceKey,
                sourceIndex,
                destinationKey,
                destinationIndex,
                uniqueId(),
                limit
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
        this.visList[this.visIndex] = performers.writeFilter(this.visList[this.visIndex], index, rule);
    }

    transpose() {
        this.visList[this.visIndex] = performers.transpose(this.visList[this.visIndex]);
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
        this.visList[this.visIndex] = performers.createBinlogField(this.visList[this.visIndex], stateKey, index, binType, newVarKey, binNumber);
        return newVarKey;
    }

    createLogField(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, scaleType: 'log10' | 'log2' | 'log', logNumber = 10) {
        this.visList[this.visIndex] = performers.createBinlogField(this.visList[this.visIndex], stateKey, index, scaleType, uniqueId(), logNumber);
    }

    renameFieldInChart(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, newName: string) {
        const origianlField = this.currentEncodings[stateKey][index];
        if (!origianlField) {
            return;
        }
        this.visList[this.visIndex] = performers.editAllField(this.visList[this.visIndex], origianlField.fid, { name: newName });
    }

    public createDateTimeDrilledField(
        stateKey: keyof Omit<DraggableFieldState, 'filters'>,
        index: number,
        drillLevel: (typeof DATE_TIME_DRILL_LEVELS)[number],
        name: string,
        format: string,
        offset: number | undefined
    ) {
        this.visList[this.visIndex] = performers.createDateDrillField(
            this.visList[this.visIndex],
            stateKey,
            index,
            drillLevel,
            uniqueId(),
            name,
            format,
            offset ?? new Date().getTimezoneOffset()
        );
    }

    public createDateFeatureField(
        stateKey: keyof Omit<DraggableFieldState, 'filters'>,
        index: number,
        drillLevel: (typeof DATE_TIME_FEATURE_LEVELS)[number],
        name: string,
        format: string,
        offset: number | undefined
    ) {
        this.visList[this.visIndex] = performers.createDateFeatureField(
            this.visList[this.visIndex],
            stateKey,
            index,
            drillLevel,
            uniqueId(),
            name,
            format,
            offset ?? new Date().getTimezoneOffset()
        );
    }

    setFieldAggregator(stateKey: keyof Omit<DraggableFieldState, 'filters'>, index: number, aggName: IAggregator) {
        this.visList[this.visIndex] = performers.setFieldAggregator(this.visList[this.visIndex], stateKey, index, aggName);
    }

    setFilterAggregator(index: number, aggName: IAggregator | '') {
        this.visList[this.visIndex] = performers.setFilterAggregator(this.visList[this.visIndex], index, aggName);
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
    }

    appendRaw(data: string) {
        const newChart = importFull(data);
        this.visList.push(newChart);
        this.createdVis += 1;
        this.visIndex = this.visList.length - 1;
    }

    importRaw(data: string[]) {
        this.visList = data.map(importFull);
        this.createdVis = this.visList.length;
        this.visIndex = 0;
    }

    appendFromCode(data: IVisSpec | IChart) {
        const newChart = fromSnapshot(parseChart(data));
        this.visList.push(newChart);
        this.createdVis += 1;
        this.visIndex = this.visList.length - 1;
    }

    setAskvizFeedback(show: boolean) {
        this.showAskvizFeedbackIndex = show ? this.visIndex : undefined;
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

    updatePaint(paintMap: IPaintMapV2 | null, name: string) {
        this.visList[this.visIndex] = performers.upsertPaintField(this.visList[this.visIndex], paintMap, name);
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

    setShowRenamePanel(show: boolean) {
        this.showRenamePanel = show;
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

    setShowPainter(show: boolean) {
        this.showPainterPanel = show;
    }

    updateLastSpec(spec: string) {
        this.lastSpec = spec;
    }

    setComputedFieldFid(fid?: string) {
        this.editingComputedFieldFid = fid;
    }

    upsertComputedField(fid: string, name: string, sql: string) {
        if (fid === '') {
            this.visList[this.visIndex] = performers.addSQLComputedField(this.visList[this.visIndex], uniqueId(), name, sql);
        } else {
            const originalField = this.allFields.find((x) => x.fid === fid);
            if (!originalField) return;
            const [semanticType, isAgg] = getSQLItemAnalyticType(parseSQLExpr(sql), this.allFields);
            const analyticType = semanticType === 'quantitative' ? 'measure' : 'dimension';
            const newAggName = isAgg ? 'expr' : analyticType === 'dimension' ? undefined : 'sum';
            const preAggName = originalField.aggName === 'expr' ? 'expr' : originalField.aggName === undefined ? undefined : 'sum';

            this.visList[this.visIndex] = performers.editAllField(this.visList[this.visIndex], fid, {
                name,
                analyticType,
                semanticType,
                ...(preAggName !== newAggName ? { aggName: newAggName } : {}),
                expression: { as: fid, op: 'expr', params: [{ type: 'sql', value: sql }] },
            });
        }
    }

    removeComputedField(sourceKey: keyof DraggableFieldState, sourceIndex: number) {
        const oriF = this.currentEncodings[sourceKey][sourceIndex];
        if (oriF.computed) {
            this.visList[this.visIndex] = performers.removeAllField(this.visList[this.visIndex], oriF.fid);
        }
    }

    replaceWithNLPQuery(query: string, response: string) {
        this.visList[this.visIndex] = performers.replaceWithNLPQuery(this.visList[this.visIndex], query, response);
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
            f && (chart.encodings.rows = chart.encodings.rows.concat([f]));
        }
    }
    if (spec.position) {
        const [cols, rows] = spec.position;
        if (cols) {
            const f = fields.find((f) => f.fid === cols);
            f && (chart.encodings.columns = chart.encodings.columns.concat([f]));
        }
        if (rows) {
            const f = fields.find((f) => f.fid === rows);
            f && (chart.encodings.rows = chart.encodings.rows.concat([f]));
        }
    }
    if (spec.color && spec.color.length > 0) {
        const color = spec.color[0];
        const f = fields.find((f) => f.fid === color);
        f && (chart.encodings.color = chart.encodings.color.concat([f]));
    }
    if (spec.size && spec.size.length > 0) {
        const size = spec.size[0];
        const f = fields.find((f) => f.fid === size);
        f && (chart.encodings.size = chart.encodings.size.concat([f]));
    }
    if (spec.opacity && spec.opacity.length > 0) {
        const opacity = spec.opacity[0];
        const f = fields.find((f) => f.fid === opacity);
        f && (chart.encodings.opacity = chart.encodings.opacity.concat([f]));
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
