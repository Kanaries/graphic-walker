import type { IAggregator, IExpression, ISemanticType } from "../../interfaces"


export type IStackMode = 'zero' | 'center' | 'normalize' | 'none';
export type ISortType = 'asc' | 'desc';

export interface IVisEncodingChannelRef {
    field: string;
    aggregate?: IAggregator;
    stack?: IStackMode;
    sort?: ISortType;
}

export type IVisEncodingChannel = IVisEncodingChannelRef | string;

export interface IVisField {
    key: string;
    type: ISemanticType;
    name?: string;
    description?: string;
    format?: string;
    expression?: IExpression;
}

export type IVisEncodingKey = (
    'x' | 'y' | 'color' | 'size' | 'shape' | 'opacity' | 'text' | 'xFacet' | 'yFacet' | 'xOffset' | 'yOffset' | 'row' | 'column' | 'theta' | 'radius' | 'details'
);

export type IVisEncodings = {
    [key in IVisEncodingKey]?: (
        key extends 'x' | 'y' | 'details' ? (IVisEncodingChannel | IVisEncodingChannel[]) : IVisEncodingChannel
    );
};

export interface IVisDataset {
    datasetId: string;
    dimensions: IVisField[];
    measures: IVisField[];
    name?: string;
}

export interface IVisFilterOneOf {
    type: 'oneOf';
    field: string;
    value: Array<string | number>;
}

export interface IVisFilterRange {
    type: 'range';
    field: string;
    min: number;
    max: number;
}

export type IVisFilter = (
    | IVisFilterOneOf
    | IVisFilterRange
);

export type IVisConfigSize = {
    /** @default "self" */
    type?: 'cell' | 'self';
    width: number;
    height: number;
}

export interface IVisSpec {
    schema?: string;
    datasetId: string;
    encodings: IVisEncodings;
    filters?: IVisFilter[];
    markType: string;
    size?: IVisConfigSize;
    configs?: Record<string, any>;
}
