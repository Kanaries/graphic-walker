import type { IDataQueryPayload, IFilterFiledSimple, IRow } from '../../graphic-walker/src/interfaces';
import { filter } from '../../graphic-walker/src/lib/filter';
import { transformData } from '../../graphic-walker/src/lib/transform';
import { queryView } from '../../graphic-walker/src/lib/viewQuery';
import { sortBy } from '../../graphic-walker/src/lib/sort';

export async function executeClient(data: IRow[], payload: IDataQueryPayload): Promise<IRow[]> {
    let result = data;
    for (const step of payload.workflow) {
        switch (step.type) {
            case 'filter':
                result = filter(
                    result,
                    step.filters.map((item) => ({ fid: item.fid, rule: item.rule }) satisfies IFilterFiledSimple),
                );
                break;
            case 'transform':
                result = await transformData(result, step.transform);
                break;
            case 'view':
                for (const query of step.query) {
                    result = queryView(result, query);
                }
                break;
            case 'sort':
                result = sortBy(result, step.by, step.sort);
                break;
            default:
                throw new Error(`Unknown workflow step: ${JSON.stringify(step)}`);
        }
    }
    return result.slice(payload.offset ?? 0, payload.limit && payload.limit > 0 ? (payload.offset ?? 0) + payload.limit : undefined);
}
