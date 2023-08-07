import { transformData } from './transform'
const main = e => {
    const { dataSource, trans } = e.data;

    try {
        const ans = transformData(dataSource, trans);
        self.postMessage(ans);
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};

self.addEventListener('message', main, false);