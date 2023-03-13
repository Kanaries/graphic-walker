import { transformData } from './transform'
const main = e => {
    const { dataSource, columns } = e.data;

    try {
        const ans = transformData(dataSource, columns);
        self.postMessage(ans);
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};

self.addEventListener('message', main, false);