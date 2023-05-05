import { makeAutoObservable, observable } from 'mobx';
import { INestNode } from './inteface';
import { IAggQuery } from '../../lib/interfaces';
import { queryView } from '../../lib/viewQuery';
import { IField, IRow } from '../../interfaces';
import React, { createContext, useContext, useEffect } from 'react';
import { getMeaAggKey } from '../../utils';

class PivotTableStore {
    public leftTree: INestNode | null = null;
    public topTree: INestNode | null = null;
    public metricTable: any[][] = [];
    public dataSource: IRow[] = [];
    public metas: IField[] = [];
    public viewData: IRow[] = [];
    constructor() {
        makeAutoObservable(this, {
            leftTree: observable.ref,
            topTree: observable.ref,
            metricTable: observable.ref,
            dataSource: observable.ref,
            metas: observable.ref,
        });
    }
    public init(dataSource: IRow[], metas: IField[]) {
        this.dataSource = dataSource ?? [];
        this.metas = metas ?? [];
        this.leftTree = null;
        this.metricTable = [];
        this.topTree = null;
        this.viewData = [];
    }
    public async queryData(leftQuery: IAggQuery, topQuery: IAggQuery) {
        const viewQuery: IAggQuery = {
            op: 'aggregate',
            groupBy: leftQuery.groupBy.concat(topQuery.groupBy),
            measures: leftQuery.measures.concat(topQuery.measures).map(mea => ({
                field: mea.field,
                agg: mea.agg,
                asFieldKey: getMeaAggKey(mea.field, mea.agg)
            }))
        };
        const viewData = queryView(this.dataSource, this.metas, viewQuery);
        this.viewData = viewData;
    }
}

const initStore = new PivotTableStore();
const PTContext = createContext<PivotTableStore>(initStore);

export interface PivotTableDataProps {
    data: IRow[];
    metas: IField[];
}
export const PivotTableStoreWrapper: React.FC<PivotTableDataProps> = (props) => {
    const { data, metas } = props;
    useEffect(() => {
        initStore.init(data, metas);
    }, [data, metas]);
    return <PTContext.Provider value={initStore}>{props.children}</PTContext.Provider>;
};


export function usePivotTableStore () {
    return useContext(PTContext)
}