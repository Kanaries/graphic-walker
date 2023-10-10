import { IRow, IViewQuery } from '../interfaces';
import { queryView } from '../lib/viewQuery';

const main = (e: { data: { dataSource: IRow[]; query: IViewQuery } }) => {
    try {
        const { dataSource, query } = e.data;
        const ans = queryView(dataSource, query);
        self.postMessage(ans);
    } catch (err: any) {
        console.error(err.stack);
        self.postMessage(err.stack);
    }
};

self.addEventListener('message', main, false);
