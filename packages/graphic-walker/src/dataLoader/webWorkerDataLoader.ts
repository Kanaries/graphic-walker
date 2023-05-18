import type { GWPreviewFunction, GWStatFieldFunction, GWStatFunction, GWTransformFunction, IGWDataLoader } from ".";
import { applyFilter, applyViewQuery, transformDataService } from "../services";


export default class WebWorkerDataLoader implements IGWDataLoader {

    preview: GWPreviewFunction = async (payload, options) => {
        const { pageIndex, pageSize } = payload;
        const { dataset } = options;
        const data = dataset.dataSource;
        const start = pageIndex * pageSize;
        const end = start + pageSize;
        const res = data.slice(start, end);
        return res;
    }

    stat: GWStatFunction = async dataset => {
        return {
            count: dataset.dataSource.length,
        };
    }

    transform: GWTransformFunction = async (payload, options) => {
        const { dataset, columns } = options;
        const data = dataset.dataSource;
        let res = data;
        if ('chartId' in payload) {
            return res;
        }
        for await (const step of payload.query.workflow) {
            switch (step.type) {
                case 'filter': {
                    res = await applyFilter(res, step.filters);
                    break;
                }
                case 'transform': {
                    res = await transformDataService(res, columns);
                    break;
                }
                case 'view': {
                    for await (const job of step.query) {
                        res = await applyViewQuery(res, columns, job);
                    }
                    break;
                }
                default: {
                    // @ts-expect-error - runtime check
                    console.warn(new Error(`Unknown step type: ${step.type}`));
                    break;
                }
            }
        }
        return res;
    };

    statField: GWStatFieldFunction = async (dataset, fid, { values = false, range = false }) => {
        let min = Infinity;
        let max = -Infinity;
        const count = dataset.dataSource.reduce<Map<string | number, number>>((tmp, d) => {
            const val = d[fid];

            if (typeof val === 'number' && range) {
                if (val < min) {
                    min = val;
                }
                if (val > max) {
                    max = val;
                }
            }

            tmp.set(val, (tmp.get(val) ?? 0) + 1);
            
            return tmp;
        }, new Map<string | number, number>());

        return {
            values: values ? [...count].map(([key, value]) => ({
                value: key,
                count: value,
            })) : [],
            range: range ? [min, max] : [0, 0],
        };
    };

}
