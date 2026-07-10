import type { IComputationFunction, IDataQueryPayload, IRow } from '../../interfaces';
import { filter as applyFilter } from '../filter';
import { transformData } from '../transform';
import { queryView } from '../viewQuery';
import { sortBy } from '../sort';

/**
 * Worker-free computation function mirroring `dataQueryClient` semantics,
 * for tests only (the production client computation goes through vite
 * `?worker&inline` imports that jest cannot resolve).
 *
 * Keep step semantics in sync with computation/clientComputation.ts.
 */
export const getTestComputation = (rawData: IRow[]): IComputationFunction => {
    return async (payload: IDataQueryPayload) => {
        let res = rawData;
        for (const step of payload.workflow) {
            switch (step.type) {
                case 'filter':
                    res = applyFilter(
                        res,
                        step.filters.map((f) => ({ fid: f.fid, rule: f.rule }))
                    );
                    break;
                case 'transform':
                    res = await transformData(res, step.transform);
                    break;
                case 'view':
                    for (const job of step.query) {
                        res = queryView(res, job);
                    }
                    break;
                case 'sort':
                    res = sortBy(res, step.by, step.sort);
                    break;
            }
        }
        const offset = payload.offset ?? 0;
        return res.slice(offset, payload.limit && payload.limit > 0 ? offset + payload.limit : undefined);
    };
};
