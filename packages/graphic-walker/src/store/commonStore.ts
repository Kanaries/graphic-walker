import { DataSet, Filters, IDataSet, IDataSetInfo, IDataSource, IMutField, IRow } from '../interfaces';
import { makeAutoObservable, observable, toJS } from 'mobx';
import { transData } from '../dataSource/utils';
import { extendCountField } from '../utils';
import { DBEngine } from '../db';

export class CommonStore {
    public datasets: IDataSet[] = [];
    public dataSources: IDataSource[] = [];
    public dsIndex: number = 0;
    public tmpDSName: string = '';
    public tmpDSRawFields: IMutField[] = [];
    public tmpDataSource: IRow[] = [];
    public showDSPanel: boolean = false;
    public showInsightBoard: boolean = false;
    public vizEmbededMenu: { show: boolean; position: [number, number] } = { show: false, position: [0, 0] };

    public filters: Filters = {};
    public db!: DBEngine;
    constructor () {
        this.db = new DBEngine();
        this.datasets = [];
        this.dataSources = [];
        makeAutoObservable(this, {
            dataSources: observable.ref,
            tmpDataSource: observable.ref,
            filters: observable.ref,
            db: false
        });
    }
    public get currentDataset (): DataSet {
        const datasetIndex = this.dsIndex;
        if (this.datasets.length > 0) {
            const dataSourceId = this.datasets[datasetIndex].dsId;
            const dataSource = this.dataSources.find(d => d.id === dataSourceId);
            const rawFields = toJS(this.datasets[datasetIndex].rawFields)
            const base = extendCountField((dataSource ? dataSource.data : []), rawFields)
            return {
                ...this.datasets[datasetIndex],
                dataSource: base.dataSource,
                rawFields: base.fields
            }
        }
        return {
            id: '__null_ds__',
            name: 'Empty Dataset',
            rawFields: [],
            dataSource: []
        }
    }
    public setShowDSPanel (show: boolean) {
        this.showDSPanel = show;
    }
    public setShowInsightBoard (show: boolean) {
        this.showInsightBoard = show;
    }
    public showEmbededMenu (position: [number, number]) {
        this.vizEmbededMenu.show = true;
        this.vizEmbededMenu.position = position;
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

    public updateTempFieldAnalyticType (fieldKey: string, analyticType: IMutField['analyticType']) {
        const field = this.tmpDSRawFields.find(f => f.fid === fieldKey);
        if (field) {
            field.analyticType = analyticType;
        }
    }

    public updateTempName (name: string) {
        this.tmpDSName = name;
    }

    public updateTempDS (rawData: IRow[]) {
        const result = transData(rawData);
        // TODO: need fix web-data-loader issue #2
        this.tmpDataSource = result.dataSource.slice(0, -1);
        this.tmpDSRawFields = result.fields;
    }

    public updateTempSTDDS (dataset: IDataSetInfo) {
        this.tmpDataSource = dataset.dataSource;
        this.tmpDSRawFields = dataset.rawFields;
        this.tmpDSName = dataset.name;
    }

    public async commitTempDS () {
        const { tmpDSName, tmpDSRawFields, tmpDataSource } = this;
        await this.addAndUseDS({
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
    public async addAndUseDS(dataset: IDataSetInfo) {
        const datasetId = await this.addDS(dataset);
        this.dsIndex = this.datasets.length - 1;
        return datasetId
    }
    public async createDataset (dataset: IDataSetInfo) {
        if (this.db.db) {
            const timestamp = new Date().getTime();
            const datasetId = `dst${timestamp}`
            const fileName = `${datasetId}.json`
            await this.db.db.registerFileText(fileName, JSON.stringify(dataset.dataSource));
            const conn = await this.db.db.connect();
            await conn.insertJSONFromPath(fileName, { name: datasetId })
            await conn.close()
            await this.db.db.dropFile(fileName);
            const newDataset: IDataSet = {
                id: datasetId,
                name: dataset.name,
                rawFields: dataset.rawFields,
                dsId: datasetId
            }
            this.datasets.push(newDataset)
            return newDataset
        } else {
            throw new Error('DB is not init.')
        }
    }
    public async queryInDataset (datasetId: string, sql: string) {
        const dataset = this.datasets.find(d => d.id === datasetId);
        if (!dataset) throw new Error('dataset not existed')
        console.log('query in dataset', dataset)
        return this.db.query(sql.replace('{table}', dataset.dsId))
    }
    public async addDS(datasetInfo: IDataSetInfo) {
        const timestamp = new Date().getTime();
        // const dataSetId = `dst_${timestamp}`
        const dataSourceId = `dse_${timestamp}`;
        let createdDataset: IDataSet | null = null;
        if (this.db.db) {
            createdDataset = await this.createDataset(datasetInfo)
        } else {
            throw new Error("DB is not init.")
        }
        this.dataSources.push({
            id: dataSourceId,
            data: datasetInfo.dataSource
        })
        // this.datasets.push({
        //     id: dataSetId,
        //     name: dataset.name,
        //     rawFields: dataset.rawFields,
        //     dsId: dataSourceId
        // })
        return createdDataset?.id
    }
    public removeDS(datasetId: string) {
        const datasetIndex = this.datasets.findIndex(d => d.id === datasetId);
        if (datasetIndex > -1) {
            const dataSourceId = this.datasets[datasetIndex].dsId;
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
    public async createPlaceholderDS() {
        this.addDS({
            name: 'new dataset',
            dataSource: [],
            rawFields: []
        })
    }
    public setFilters (props: Filters) {
        this.filters = props;
    }
    public destroy () {
        this.dataSources = [];
        this.datasets = [];
    }
}