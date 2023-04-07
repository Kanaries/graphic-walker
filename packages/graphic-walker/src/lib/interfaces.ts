import { IAggregator } from "../interfaces";

export interface IAggQuery {
    op: 'aggregate';
    groupBy: string[];
    agg: {
        [field: string]: IAggregator;
    };
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
}
