import { IAggregator } from "../interfaces";

export interface IAggQuery {
    op: 'aggregate';
    groupBy: string[];
    measures: { field: string; agg: IAggregator; asFieldKey: string }[];
}

// interface IFilterQuery {
//     op: 'filter';
//     filter: string;
// }

export interface IFoldQuery {
    op: 'fold';
    foldBy: string[];
    newFoldKeyCol: string;
    newFoldValueCol: string;
}

export interface IBinQuery {
    op: 'bin';
    binBy: string;
    newBinCol: string;
    binSize: number;
}


export interface IRawQuery {
    op: 'raw';
    fields: string[];
}
