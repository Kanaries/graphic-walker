import { IRow, IFieldTransform } from '../interfaces';
import { transformData } from '../lib/transform';

const main = (e: { data: { dataSource: IRow[]; trans: IFieldTransform[] } }) => {
    const { dataSource, trans } = e.data;

    try {
        const ans = transformData(dataSource, trans);
        self.postMessage(ans);
    } catch (error: any) {
        self.postMessage({ error: error.message });
    }
};

self.addEventListener('message', main, false);
