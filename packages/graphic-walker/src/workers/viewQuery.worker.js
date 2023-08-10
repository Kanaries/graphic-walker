import { queryView } from '../lib/viewQuery'
const main = e => {
    try {
        const { dataSource, query } = e.data;
        const ans = queryView(dataSource, query);
        self.postMessage(ans);

    } catch (err) {
        // console.log(err.s)
        // log err stack
        console.error(err.stack);
        self.postMessage(err.stack);
    }
};

self.addEventListener('message', main, false);
