import { IRow } from '../interfaces';
import { aggregate } from './op/aggregate';
import { fold } from './op/fold';
import { bin } from './op/bin';
import { IViewQuery } from '../interfaces';

export function queryView(rawData: IRow[], query: IViewQuery) {
    switch (query.op) {
        case 'aggregate':
            return aggregate(rawData, query);
        case 'fold':
            return fold(rawData, query);
        case 'bin':
            return bin(rawData, query);
        case 'raw':
        default:
            return rawData;
    }
}
