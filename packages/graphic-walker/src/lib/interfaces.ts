export interface IAggQuery {
    op: 'aggregate';
    groupBy: string[];
    agg: {
        [field: string]:
            | 'sum'
            | 'count'
            | 'max'
            | 'min'
            | 'mean'
            | 'median'
            | 'variance'
            | 'stdev';
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
