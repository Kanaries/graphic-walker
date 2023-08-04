import { IViewField, IRow } from '../interfaces';
import { getMeaAggKey } from '../utils';

function compareMulti(a: number[], b: number[]): number {
    if (a.length < b.length) return -compareMulti(b, a);
    for (let i = 0; i < a.length; i++) {
        if (!b[i]) return 1;
        const c = a[i] - b[i];
        if (c !== 0) return c;
    }
    return 0;
}

export function sortBy(data: IRow[], viewMeasures: IViewField[], sort: 'ascending' | 'descending') {
    const sortM = sort === 'ascending' ? 1 : -1;
    return data
        .map((x) => ({
            data: x,
            value: viewMeasures.map((f) => x[getMeaAggKey(f.fid, f.aggName)]),
        }))
        .sort((a, b) => sortM * compareMulti(a.value, b.value))
        .map((x) => x.data);
}