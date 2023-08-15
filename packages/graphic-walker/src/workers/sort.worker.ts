import { IRow } from '../interfaces';
import { sortBy } from '../lib/sort';

const main = (e: {
    data: {
        data: IRow[];
        viewMeasures: string[];
        sort: 'ascending' | 'descending';
    };
}) => {
    try {
        const { data, viewMeasures, sort } = e.data;
        const ans = sortBy(data, viewMeasures, sort);
        self.postMessage(ans);
    } catch (err: any) {
        console.error(err.stack);
        self.postMessage(err.stack);
    }
};

self.addEventListener('message', main, false);
