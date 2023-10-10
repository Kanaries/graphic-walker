import { IRow, IFilterFiledSimple } from '../interfaces';
import { filter } from '../lib/filter';

const main = (e: { data: { dataSource: IRow[]; filters: IFilterFiledSimple[] } }) => {
    const { dataSource, filters } = e.data;

    const filtered = filter(dataSource, filters);

    self.postMessage(filtered);
};

self.addEventListener('message', main, false);
