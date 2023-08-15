import { IMutField, IRow } from "../interfaces";
import { aggregate } from "./op/aggregate";
import { fold } from "./op/fold";
import { IAggQuery, IBinQuery, IFoldQuery, IRawQuery } from "./interfaces";
import { bin } from "./op/bin";

export type IViewQuery = IAggQuery | IFoldQuery | IBinQuery | IRawQuery;

export function queryView (rawData: IRow[], query: IViewQuery, metas: IMutField[]) {
    switch (query.op) {
        case 'aggregate':
            return aggregate(rawData, query);
        case 'fold':
            return fold(rawData, query, metas);
        case 'bin':
            return bin(rawData, query);
        case 'raw':
        default:
            return rawData;
    }

}