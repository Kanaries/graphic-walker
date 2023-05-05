import produce, { enableMapSet } from 'immer';
import type { IResponse, IRow } from '../interfaces';
import type { GWTransformFunction, IGWTransformer } from ".";


enableMapSet();

interface IGWTransformerOptions {
    server: string;
}

export default class KanariesServerTransformer implements IGWTransformer {

    constructor(protected readonly options: IGWTransformerOptions) {}

    transform: GWTransformFunction = async payload => {
        const data = produce(payload, draft => {
            for (const step of draft.workflow) {
                if (step.type === 'filter') {
                    for (const filter of step.filters) {
                        if (filter.rule.type === 'one of') {
                            // @ts-expect-error - stringify all sets as array
                            filter.rule.value = Array.from(filter.rule.value);
                        }
                    }
                }
            }
        });
        const res = await fetch(`${this.options.server}/api/data/v1/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (res.status === 200 || res.status === 500) {
            const result = await res.json() as IResponse<IRow[]>;
            if (result.success === false) {
                throw new Error(result.message);
            }
            return result.data;
        } else {
            throw new Error(`Failed to query data from server. ${res.status}: ${res.statusText}`);
        }
    };

}
