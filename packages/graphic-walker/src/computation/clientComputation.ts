import type { IDataQueryWorkflowStep, IFieldStats, IDatasetStats, IFilterField, IRow, IViewField } from "../interfaces";
import { applyFilter, applyViewQuery, transformDataService } from "../services";


export const datasetStatsClient = async (rawData: IRow[]): Promise<IDatasetStats> => {
    return {
        rowCount: rawData.length,
    };
};

export const dataReadRawClient = async (rawData: IRow[], pageSize: number, pageOffset = 0): Promise<IRow[]> => {
    return rawData.slice(pageOffset * pageSize, (pageOffset + 1) * pageSize);
};

export const dataQueryClient = async (
    rawData: IRow[],
    columns: Omit<IViewField, 'dragId'>[],
    workflow: IDataQueryWorkflowStep[],
): Promise<IRow[]> => {
    let res = rawData;
    for await (const step of workflow) {
        switch (step.type) {
            case 'filter': {
                res = await applyFilter(res, step.filters.map<IFilterField>(filter => {
                    const f = columns.find(c => c.fid === filter.field);
                    if (!f) {
                        return null!;
                    }
                    const res: IFilterField = {
                        fid: f.fid,
                        dragId: '',
                        semanticType: f.semanticType,
                        analyticType: f.analyticType,
                        name: f.name || f.fid,
                        rule: null,
                    };
                    if (filter.type === 'oneOf') {
                        res.rule = {
                            type: 'one of',
                            value: new Set(filter.value),
                        };
                    } else if (filter.type === 'range') {
                        res.rule = {
                            type: f.semanticType === 'temporal' ? 'temporal range' : 'range',
                            value: [filter.min, filter.max],
                        };
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

export const fieldStatClient = async (data: IRow[], fid: string): Promise<IFieldStats> => {
    let min = Infinity;
    let max = -Infinity;
    const count = data.reduce<Map<string | number, number>>((tmp, d) => {
        const val = d[fid];

        if (typeof val === 'number') {
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
        values: [...count].map(([key, value]) => ({
            value: key,
            count: value,
        })),
        range: [min, max],
    };
};
