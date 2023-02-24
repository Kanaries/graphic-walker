import { StatFuncName } from "visual-insights/build/esm/statistics";
import { AggFC } from 'cube-core/built/types';
import { IAnalyticType, IMutField as VIMutField, ISemanticType } from 'visual-insights';

export type DeepReadonly<T extends Record<keyof any, any>> = {
    readonly [K in keyof T]: T[K] extends Record<keyof any, any> ? DeepReadonly<T[K]> : T[K];
};

export interface IRow {
    [key: string]: any;
}
/**
 * @deprecated
 */
export type SemanticType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal';

export interface Filters {
    [key: string]: any[];
}

export interface IMutField {
    fid: string;
    key?: string;
    name?: string;
    disable?: boolean;
    semanticType: ISemanticType;
    analyticType: IAnalyticType;
};

export interface IUncertainMutField {
    fid: string;
    key?: string;
    name?: string;
    disable?: boolean;
    semanticType: ISemanticType | '?';
    analyticType: IAnalyticType | '?';
}

export interface IField {
    /**
     * fid: key in data record
     */
    fid: string;
    /**
     * display name for field
     */
    name: string;
    /**
     * aggregator's name
     */
    aggName?: string;
    semanticType: ISemanticType;
    analyticType: IAnalyticType;
    cmp?: (a: any, b: any) => number;
}

export interface IViewField extends IField {
    dragId: string;
    sort?: 'none' | 'ascending' | 'descending';
}

export interface Measure extends IField {
    aggregator?: AggFC;
    minWidth?: number;
    formatter?: (value: number | undefined) => number | string;
    [key: string]: any;
}

export interface DataSet {
    id: string;
    name: string;
    rawFields: IMutField[];
    dataSource: IRow[];
}

export interface IFieldNeighbor {
    key: string;
    cc: number;
}

export interface IMeasure {
    key: string;
    op: StatFuncName
}

export interface IDataSet {
    id: string;
    name: string;
    rawFields: IMutField[];
    dsId: string;
}
/**
 * use as props to create a new dataset(IDataSet).
 */
export interface IDataSetInfo {
    name: string;
    rawFields: IMutField[];
    dataSource: IRow[]
}

export interface IDataSource {
    id: string;
    data: IRow[]
}

export interface IFilterField extends IViewField {
    rule: IFilterRule | null;
}

export interface DraggableFieldState {
    fields: IViewField[];
    dimensions: IViewField[];
    measures: IViewField[];
    rows: IViewField[];
    columns: IViewField[];
    color: IViewField[];
    opacity: IViewField[];
    size: IViewField[];
    shape: IViewField[];
    theta: IViewField[];
    radius: IViewField[];
    filters: IFilterField[];
}

export interface IDraggableStateKey {
    id: keyof DraggableFieldState;
    mode: number
}

export type IFilterRule = {
    type: 'range';
    value: readonly [number, number];
} | {
    type: 'temporal range';
    value: readonly [number, number];
} | {
    type: 'one of';
    value: Set<string | number>;
};

export const EXPLORATION_TYPES = [
    'none',
    'brush',
    'point',
] as const;

export const BRUSH_DIRECTIONS = [
    'default',
    'x',
    'y',
] as const;

export type IStackMode = 'none' | 'stack' | 'normalize';
export type IExplorationType = (typeof EXPLORATION_TYPES)[number];
export type IBrushDirection = (typeof BRUSH_DIRECTIONS)[number];

export interface IVisualConfig {
    defaultAggregated: boolean;
    geoms:  string[];        
    stack: IStackMode;
    showActions: boolean;
    interactiveScale: boolean;
    sorted: 'none' | 'ascending' | 'descending';
    size: {
        mode: 'auto' | 'fixed';
        width: number;
        height: number;
    }
    exploration: {
        mode: IExplorationType;
        /** works when mode is 'brush' */
        brushDirection: IBrushDirection;
    };
}

export interface IVisSpec {
    readonly visId: string;
    readonly name?: [string, Record<string, any>?];
    readonly encodings: DeepReadonly<DraggableFieldState>;
    readonly config: DeepReadonly<IVisualConfig>;
}

export enum ISegmentKey {
    vis = 'vis',
    data = 'data'
}