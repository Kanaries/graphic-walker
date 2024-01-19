import { makeAutoObservable, observable, toJS } from 'mobx';
import { IDataSetInfo, IDataSourceProvider, IMutField, IRow } from '../interfaces';
import { transData } from '../dataSource/utils';

export class CommonStore {
    public tmpDSName: string = '';
    public tmpDSRawFields: IMutField[] = [];
    public tmpDataSource: IRow[] = [];
    public showDSPanel: boolean = false;
    public provider: IDataSourceProvider;
    private onCommitDS: (datasetId: string) => void;
    public displayOffset: number | undefined;
    constructor(provider: IDataSourceProvider, onCommitDS: (datasetId: string) => void, config: {displayOffset?: number}) {
        this.provider = provider;
        this.onCommitDS = onCommitDS;
        this.displayOffset = config.displayOffset;
        makeAutoObservable(this, {
            tmpDataSource: observable.ref,
        });
    }
    public setShowDSPanel(show: boolean) {
        this.showDSPanel = show;
    }
    public initTempDS() {
        this.tmpDSName = 'New Dataset';
        this.tmpDSRawFields = [];
        this.tmpDataSource = [];
    }
    public updateTempFields(fields: IMutField[]) {
        this.tmpDSRawFields = fields;
    }

    public updateTempDatasetMetas(fid: string, diffMeta: Partial<IMutField>) {
        const field = this.tmpDSRawFields.find((f) => f.fid === fid);
        if (field) {
            for (let mk in diffMeta) {
                field[mk] = diffMeta[mk];
            }
        }
    }

    public updateTempFieldAnalyticType(fieldKey: string, analyticType: IMutField['analyticType']) {
        const field = this.tmpDSRawFields.find((f) => f.fid === fieldKey);
        if (field) {
            field.analyticType = analyticType;
        }
    }

    public updateTempFieldSemanticType(fieldKey: string, semanticType: IMutField['semanticType']) {
        const field = this.tmpDSRawFields.find((f) => f.fid === fieldKey);
        if (field) {
            field.semanticType = semanticType;
        }
    }

    public updateTempName(name: string) {
        this.tmpDSName = name;
    }

    public updateTempDS(rawData: IRow[]) {
        const result = transData(rawData);
        this.tmpDataSource = result.dataSource;
        this.tmpDSRawFields = result.fields;
    }
    /**
     * update temp dataset (standard) with dataset info
     * @param dataset
     */
    public updateTempSTDDS(dataset: IDataSetInfo) {
        this.tmpDataSource = dataset.dataSource;
        this.tmpDSRawFields = dataset.rawFields;
        this.tmpDSName = dataset.name;
    }

    public commitTempDS() {
        const { tmpDSName, tmpDSRawFields, tmpDataSource } = this;
        this.provider.addDataSource(toJS(tmpDataSource), toJS(tmpDSRawFields), tmpDSName).then(this.onCommitDS);
        this.setShowDSPanel(false);
        this.initTempDS();
    }

    public startDSBuildingTask() {
        this.initTempDS();
        this.showDSPanel = true;
    }

    public setDisplayOffset(displayOffset?: number) {
        this.displayOffset = displayOffset;
    }
}
