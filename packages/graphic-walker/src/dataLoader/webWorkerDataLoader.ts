import { applyFilter, applyViewQuery, transformDataService } from "../services";
import type { IVisDataset, IVisField } from "../vis/protocol/interface";
import type { IFilterField, IRow } from "../interfaces";
import type { GWLoadDataFunction, GWLoadMetaFunction, GWStatFieldFunction, GWStatFunction, GWTransformFunction, GWSyncDataFunction, GWSyncMetaFunction, IGWDataLoader } from ".";


export default class WebWorkerDataLoader implements IGWDataLoader {

    protected dataset: IVisDataset | null = null;
    protected data: IRow[] = [];

    syncMeta: GWSyncMetaFunction = async dataset => {
        this.dataset = dataset;
    }

    syncData: GWSyncDataFunction = async dataSource => {
        this.data = dataSource;
    }

    loadMeta: GWLoadMetaFunction = async () => {
        if (!this.dataset) {
            throw new Error('No dataset loaded');
        }
        return this.dataset;
    }

    loadData: GWLoadDataFunction = async payload => {
        if (!this.dataset) {
            return [];
        }
        const { pageIndex, pageSize } = payload;
        const start = pageIndex * pageSize;
        const end = start + pageSize;
        const res = this.data.slice(start, end);
        return res;
    }

    stat: GWStatFunction = async () => {
        return {
            count: this.data.length,
        };
    }

    query: GWTransformFunction = async payload => {
        if (!this.dataset) {
            return [];
        }
        const columns = this.dataset.dimensions.map<IVisField & { analyticType: 'dimension' | 'measure' }>(f => ({
            ...f,
            analyticType: 'dimension',
        })).concat(this.dataset.measures.map(f => ({
            ...f,
            analyticType: 'measure',
        })));
        let res = this.data;
        for await (const step of payload.workflow) {
            switch (step.type) {
                case 'filter': {
                    res = await applyFilter(res, step.filters.map<IFilterField>(filter => {
                        const f = columns.find(c => c.key === filter.field);
                        if (!f) {
                            return null!;
                        }
                        const res: IFilterField = {
                            fid: f.key,
                            dragId: '',
                            semanticType: f.type,
                            analyticType: f.analyticType,
                            name: f.name || f.key,
                            rule: null,
                        };
                        if (filter.type === 'oneOf') {
                            res.rule = {
                                type: 'one of',
                                value: new Set(filter.value),
                            };
                        } else if (filter.type === 'range') {
                            res.rule = {
                                type: f.type === 'temporal' ? 'temporal range' : 'range',
                                value: [filter.min, filter.max],
                            }
                        }
                        return res;
                    }).filter(Boolean));
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

    statField: GWStatFieldFunction = async (fid, { values = false, range = false }) => {
        let min = Infinity;
        let max = -Infinity;
        const count = this.data.reduce<Map<string | number, number>>((tmp, d) => {
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
