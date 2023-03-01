export interface IAggQuery {
    op: 'aggregate';
    groupBy: string[];
    agg: {
        [field: string]: 'sum' | 'avg' | 'count' | 'max' | 'min';
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