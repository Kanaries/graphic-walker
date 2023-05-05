import type { GWTransformFunction, IGWTransformer } from ".";
import { applyFilter, applyViewQuery, transformDataService } from "../services";


export default class WebWorkerTransformer implements IGWTransformer {

    transform: GWTransformFunction = async (payload, options) => {
        const { dataset, columns } = options;
        const data = dataset.dataSource;
        let res = data;
        for await (const step of payload.workflow) {
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

}
