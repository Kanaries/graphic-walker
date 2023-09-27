import { ICreateField, DataSet, Filters, IDataSet, IDataSetInfo, IDataSource, IMutField, IRow, ISegmentKey } from '../interfaces';
import { makeAutoObservable, observable, toJS } from 'mobx';
import { transData } from '../dataSource/utils';
import { INestNode } from '../components/pivotTable/inteface';

export class CommonStore {
    public datasets: IDataSet[] = [];
    public dataSources: IDataSource[] = [];
    public dsIndex: number = 0;
    public tmpDSName: string = '';
    public tmpDSRawFields: IMutField[] = [];
    public tmpDataSource: IRow[] = [];
    public showDSPanel: boolean = false;
    public showLogSettingPanel: boolean = false;
    public showBinSettingPanel: boolean = false;
    public showInsightBoard: boolean = false;
    public createField: ICreateField | undefined = undefined; 
    public vizEmbededMenu: { show: boolean; position: [number, number] } = { show: false, position: [0, 0] };
    public showDataConfig: boolean = false;
    public showCodeExportPanel: boolean = false;
    public showVisualConfigPanel: boolean = false;
    public showGeoJSONConfigPanel: boolean = false;
    public filters: Filters = {};
    public segmentKey: ISegmentKey = ISegmentKey.vis;
    public selectedMarkObject: Record<string, string | number | undefined> = {};
    public tableCollapsedHeaderMap: Map<string, INestNode["path"]> = new Map();
    public showErrorResolutionPanel: number = 0;

    constructor () {
        this.datasets = [];
        this.dataSources = [];
        makeAutoObservable(this, {
            dataSources: observable.ref,
            tmpDataSource: observable.ref,
            filters: observable.ref,
            tableCollapsedHeaderMap: observable.ref,
        });
    }
    public get currentDataset (): DataSet {
        const datasetIndex = this.dsIndex;
        if (this.datasets.length > 0) {
            const dataSourceId = this.datasets[datasetIndex].dsId;
            const dataSource = this.dataSources.find(d => d.id === dataSourceId);
            const rawFields = toJS(this.datasets[datasetIndex].rawFields)//.concat(createCountField())
            // const base = extendCountField((dataSource ? dataSource.data : []), rawFields)
            return {
                ...this.datasets[datasetIndex],
                dataSource: dataSource?.data ?? [],
                rawFields
            }
        }
        return {
            id: '__null_ds__',
            name: 'Empty Dataset',
            rawFields: [],
            dataSource: []
        }
    }
    public setSegmentKey (sk: ISegmentKey) {
        this.segmentKey = sk;
    }
    public setShowDSPanel (show: boolean) {
        this.showDSPanel = show;
    }
    public setShowDataConfig (show: boolean) {
        this.showDataConfig = show;
    }
    public setShowInsightBoard (show: boolean) {
        this.showInsightBoard = show;
    }
    public showEmbededMenu (position: [number, number]) {
        this.vizEmbededMenu.show = true;
        this.vizEmbededMenu.position = position;
    }
    public setShowCodeExportPanel (show: boolean) {
        this.showCodeExportPanel = show;
    }
    public setShowVisualConfigPanel (show: boolean) {
        this.showVisualConfigPanel = show;
    }
    public setShowLogSettingPanel (show: boolean) {
        this.showLogSettingPanel = show;
    }
    public setShowBinSettingPanel (show: boolean) {
        this.showBinSettingPanel = show;
    }
    public setCreateField ( field: ICreateField ){
        this.createField = field;
    }
    public updateTableCollapsedHeader (node: INestNode) {
        const {uniqueKey, height} = node;
        if (height < 1) return;
        const updatedMap = new Map(this.tableCollapsedHeaderMap)
        // if some child nodes of the incoming node are collapsed, remove them first
        updatedMap.forEach((existingPath, existingKey) => {
            if (existingKey.startsWith(uniqueKey) && existingKey.length > uniqueKey.length) {
                updatedMap.delete(existingKey)
            }
        })
        if (!updatedMap.has(uniqueKey)) {
            updatedMap.set(uniqueKey, node.path)
        } else {
            updatedMap.delete(uniqueKey)
        }
        this.tableCollapsedHeaderMap = updatedMap
    }
    public resetTableCollapsedHeader () {
        const updatedMap: Map<string, INestNode["path"]> = new Map();
        this.tableCollapsedHeaderMap = updatedMap;
    }
    public setShowGeoJSONConfigPanel (show: boolean) {
        this.showGeoJSONConfigPanel = show;
    }
    public closeEmbededMenu () {
        this.vizEmbededMenu.show = false;
    }
    public initTempDS () {
        this.tmpDSName = 'New Dataset'
        this.tmpDSRawFields = [];
        this.tmpDataSource = [];
    }
    public updateTempFields (fields: IMutField[]) {
        this.tmpDSRawFields = fields;
    }

    public updateCurrentDatasetMetas (fid: string, diffMeta: Partial<IMutField>) {
        const dataset = this.datasets[this.dsIndex];
        const field = dataset.rawFields.find(f => f.fid === fid);
        if (field) {
            for (let mk in diffMeta) {
                field[mk] = diffMeta[mk];
            }
        }
    }

    public updateTempDatasetMetas (fid: string, diffMeta: Partial<IMutField>) {
        const field = this.tmpDSRawFields.find(f => f.fid === fid);
        if (field) {
            for (let mk in diffMeta) {
                field[mk] = diffMeta[mk];
            }
        }
    }

    public updateTempFieldAnalyticType (fieldKey: string, analyticType: IMutField['analyticType']) {
        const field = this.tmpDSRawFields.find(f => f.fid === fieldKey);
        if (field) {
            field.analyticType = analyticType;
        }
    }

    public updateTempFieldSemanticType (fieldKey: string, semanticType: IMutField['semanticType']) {
        const field = this.tmpDSRawFields.find(f => f.fid === fieldKey);
        if (field) {
            field.semanticType = semanticType;
        }
    }

    public updateTempName (name: string) {
        this.tmpDSName = name;
    }

    public updateTempDS (rawData: IRow[]) {
        const result = transData(rawData);
        this.tmpDataSource = result.dataSource;
        this.tmpDSRawFields = result.fields;
    }
    /**
     * update temp dataset (standard) with dataset info
     * @param dataset 
     */
    public updateTempSTDDS (dataset: IDataSetInfo) {
        this.tmpDataSource = dataset.dataSource;
        this.tmpDSRawFields = dataset.rawFields;
        this.tmpDSName = dataset.name;
    }

    public commitTempDS () {
        const { tmpDSName, tmpDSRawFields, tmpDataSource } = this;
        this.addAndUseDS({
            dataSource: tmpDataSource,
            rawFields: tmpDSRawFields,
            name: tmpDSName
        })
        this.setShowDSPanel(false);
        this.initTempDS();
    }

    public startDSBuildingTask () {
        this.initTempDS();
        this.showDSPanel = true;
    }
    public addAndUseDS(dataset: IDataSetInfo, datasetId?: string | undefined) {
        const id = this.addDS(dataset, datasetId);
        this.dsIndex = this.datasets.length - 1;
        return id
    }
    public addDS(dataset: IDataSetInfo, datasetId?: string | undefined) {
        const timestamp = new Date().getTime();
        const dataSetId = datasetId || `dst-${timestamp}`
        const dataSourceId = `dse-${timestamp}`;
        this.dataSources.push({
            id: dataSourceId,
            data: dataset.dataSource
        })
        this.datasets.push({
            id: dataSetId,
            name: dataset.name,
            rawFields: dataset.rawFields,
            dsId: dataSourceId
        })
        return dataSourceId;
    }
    public removeDS(datasetId: string) {
        const datasetIndex = this.datasets.findIndex(d => d.id === datasetId);
        if (datasetIndex > -1) {
            const dataSourceId = this.datasets[datasetIndex].id;
            const dataSourceIndex = this.dataSources.findIndex(d => d.id === dataSourceId);
            this.dataSources.splice(dataSourceIndex, 1);
            this.datasets.splice(datasetIndex, 1);
        }
    }
    public useDS(datasetId: string) {
        const datasetIndex = this.datasets.findIndex(d => d.id === datasetId);
        if (datasetIndex > -1) {
            this.dsIndex = datasetIndex;
        }
    }
    public createPlaceholderDS() {
        this.addDS({
            name: 'new dataset',
            dataSource: [],
            rawFields: []
        })
    }
    public setFilters (props: Filters) {
        this.filters = props;
    }

    public updateSelectedMarkObject (newMarkObj) {
        this.selectedMarkObject = newMarkObj;
    }

    public updateShowErrorResolutionPanel(errCode: number) {
        this.showErrorResolutionPanel = errCode;
    }

    public destroy () {
        this.dataSources = [];
        this.datasets = [];
    }
}