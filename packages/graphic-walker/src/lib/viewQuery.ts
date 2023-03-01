import { IRow } from "visual-insights";
import { IMutField } from "../interfaces";
import { aggregate } from "./op/aggregate";
import { fold } from "./op/fold";
import { IAggQuery, IBinQuery, IFoldQuery } from "./interfaces";
import { bin } from "./op/bin";

export type IViewQuery = IAggQuery | IFoldQuery | IBinQuery;

export function queryView (rawData: IRow[], metas: IMutField[], query: IViewQuery) {
    switch (query.op) {
        case 'aggregate':
            return aggregate(rawData, query);
        case 'fold':
            return fold(rawData, query);
        case 'bin':
            return bin(rawData, query);
        default:
            return rawData;
    }

}