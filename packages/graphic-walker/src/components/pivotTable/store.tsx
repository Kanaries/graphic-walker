import { makeAutoObservable, observable } from 'mobx';
import { INestNode } from './inteface';
import { IField, IRow } from '../../interfaces';
import React, { createContext, useContext, useEffect } from 'react';

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
}

const initStore = new PivotTableStore();
const PTContext = createContext<PivotTableStore>(initStore);

export interface PivotTableDataProps {
    data: IRow[];
    metas: IField[];
    children?: React.ReactNode | Iterable<React.ReactNode>;
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