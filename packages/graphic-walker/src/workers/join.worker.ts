import { IDatasetForeign, IRow } from '../interfaces';
import { join } from '../lib/join';

const main = (e: {
    data: {
        rawDatasets: Record<string, IRow[]>;
        foreigns: IDatasetForeign[];
    };
}) => {
    try {
        const { rawDatasets, foreigns } = e.data;
        const ans = join(rawDatasets, foreigns);
        self.postMessage(ans);
    } catch (err: any) {
        console.error(err.stack);
        self.postMessage(err.stack);
    }
};

self.addEventListener('message', main, false);
