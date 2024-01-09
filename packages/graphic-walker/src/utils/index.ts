import i18next from 'i18next';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../constants';
import { IRow, Filters, IViewField, IFilterField } from '../interfaces';
interface NRReturns {
    normalizedData: IRow[];
    maxMeasures: IRow;
    minMeasures: IRow;
    totalMeasures: IRow;
}
function normalizeRecords(dataSource: IRow[], measures: string[]): NRReturns {
    const maxMeasures: IRow = {};
    const minMeasures: IRow = {};
    const totalMeasures: IRow = {};
    measures.forEach((mea) => {
        maxMeasures[mea] = -Infinity;
        minMeasures[mea] = Infinity;
        totalMeasures[mea] = 0;
    });
    dataSource.forEach((record) => {
        measures.forEach((mea) => {
            maxMeasures[mea] = Math.max(record[mea], maxMeasures[mea]);
            minMeasures[mea] = Math.min(record[mea], minMeasures[mea]);
        });
    });
    const newData: IRow[] = [];
    dataSource.forEach((record) => {
        const norRecord: IRow = { ...record };
        measures.forEach((mea) => {
            totalMeasures[mea] += Math.abs(norRecord[mea]);
        });
        newData.push(norRecord);
    });
    newData.forEach((record) => {
        measures.forEach((mea) => {
            record[mea] /= totalMeasures[mea];
        });
    });
    return {
        normalizedData: newData,
        maxMeasures,
        minMeasures,
        totalMeasures,
    };
}

function normalize2PositiveRecords(dataSource: IRow[], measures: string[]): NRReturns {
    const maxMeasures: IRow = {};
    const minMeasures: IRow = {};
    const totalMeasures: IRow = {};
    measures.forEach((mea) => {
        maxMeasures[mea] = -Infinity;
        minMeasures[mea] = Infinity;
        totalMeasures[mea] = 0;
    });
    dataSource.forEach((record) => {
        measures.forEach((mea) => {
            maxMeasures[mea] = Math.max(record[mea], maxMeasures[mea]);
            minMeasures[mea] = Math.min(record[mea], minMeasures[mea]);
        });
    });
    const newData: IRow[] = [];
    dataSource.forEach((record) => {
        const norRecord: IRow = { ...record };
        measures.forEach((mea) => {
            norRecord[mea] = norRecord[mea] - minMeasures[mea];
            totalMeasures[mea] += norRecord[mea];
        });
        newData.push(norRecord);
    });
    newData.forEach((record) => {
        measures.forEach((mea) => {
            record[mea] /= totalMeasures[mea];
        });
    });
    return {
        normalizedData: newData,
        maxMeasures,
        minMeasures,
        totalMeasures,
    };
}

export function checkMajorFactor(
    data: IRow[],
    childrenData: Map<any, IRow[]>,
    dimensions: string[],
    measures: string[]
): { majorKey: string; majorSum: number } {
    const { normalizedData, maxMeasures, minMeasures, totalMeasures } = normalizeRecords(data, measures);
    let majorSum = Infinity;
    let majorKey = '';
    for (let [key, childData] of childrenData) {
        let sum = 0;
        for (let record of normalizedData) {
            let target = childData.find((childRecord) => {
                return dimensions.every((dim) => record[dim] === childRecord[dim]);
            });
            if (target) {
                measures.forEach((mea) => {
                    let targetValue = typeof target![mea] === 'number' && !isNaN(target![mea]) ? target![mea] : 0;
                    targetValue = targetValue / totalMeasures[mea];
                    sum += Math.abs(record[mea] - targetValue);
                });
            } else {
                measures.forEach((mea) => {
                    sum += Math.abs(record[mea]);
                });
            }
        }
        if (sum < majorSum) {
            majorSum = sum;
            majorKey = key;
        }
    }
    majorSum /= measures.length * 2;
    return { majorKey, majorSum };
}

export function checkChildOutlier(
    data: IRow[],
    childrenData: Map<any, IRow[]>,
    dimensions: string[],
    measures: string[]
): { outlierKey: string; outlierSum: number } {
    // const { normalizedData, maxMeasures, minMeasures, totalMeasures } = normalize2PositiveRecords(data, measures);
    const { normalizedData, maxMeasures, minMeasures, totalMeasures } = normalizeRecords(data, measures);
    let outlierSum = -Infinity;
    let outlierKey = '';
    for (let [key, childData] of childrenData) {
        // const { normalizedData: normalizedChildData } = normalize2PositiveRecords(childData, measures);
        const { normalizedData: normalizedChildData } = normalizeRecords(childData, measures);
        let sum = 0;
        for (let record of normalizedData) {
            let target = normalizedChildData.find((childRecord) => {
                return dimensions.every((dim) => record[dim] === childRecord[dim]);
            });
            if (target) {
                measures.forEach((mea) => {
                    let targetValue = typeof target![mea] === 'number' && !isNaN(target![mea]) ? target![mea] : 0;
                    sum += Math.abs(record[mea] - targetValue);
                });
            } else {
                measures.forEach((mea) => {
                    sum += Math.abs(record[mea]);
                });
            }
        }
        if (sum > outlierSum) {
            outlierSum = sum;
            outlierKey = key;
        }
    }
    outlierSum /= measures.length * 2;
    return { outlierKey, outlierSum };
}
export interface IPredicate {
    key: string;
    type: 'discrete' | 'continuous';
    range: Set<any> | [number, number];
}
export function getPredicates(selection: IRow[], dimensions: string[], measures: string[]): IPredicate[] {
    const predicates: IPredicate[] = [];
    dimensions.forEach((dim) => {
        predicates.push({
            key: dim,
            type: 'discrete',
            range: new Set(),
        });
    });
    measures.forEach((mea) => {
        predicates.push({
            key: mea,
            type: 'continuous',
            range: [Infinity, -Infinity],
        });
    });
    selection.forEach((record) => {
        dimensions.forEach((dim, index) => {
            (predicates[index].range as Set<any>).add(record[dim]);
        });
        measures.forEach((mea, index) => {
            (predicates[index].range as [number, number])[0] = Math.min((predicates[index].range as [number, number])[0], record[mea]);
            (predicates[index].range as [number, number])[1] = Math.max((predicates[index].range as [number, number])[1], record[mea]);
        });
    });
    return predicates;
}

export function getPredicatesFromVegaSignals(signals: Filters, dimensions: string[], measures: string[]): IPredicate[] {
    const predicates: IPredicate[] = [];
    dimensions.forEach((dim) => {
        predicates.push({
            type: 'discrete',
            range: new Set(signals[dim]),
            key: dim,
        });
    });
    return predicates;
}

export function filterByPredicates(data: IRow[], predicates: IPredicate[]): IRow[] {
    const filterData = data.filter((record) => {
        return predicates.every((pre) => {
            if (pre.type === 'continuous') {
                return record[pre.key] >= (pre.range as [number, number])[0] && record[pre.key] <= (pre.range as [number, number])[1];
            } else {
                return (pre.range as Set<any>).has(record[pre.key]);
            }
        });
    });
    return filterData;
}

export function applyFilters(dataSource: IRow[], filters: Filters): IRow[] {
    let filterKeys = Object.keys(filters);
    return dataSource.filter((record) => {
        let keep = true;
        for (let filterKey of filterKeys) {
            if (filters[filterKey].length > 0) {
                if (!filters[filterKey].includes(record[filterKey])) {
                    keep = false;
                    break;
                }
            }
        }
        return keep;
    });
}

export function createCountField(): IViewField {
    return {
        // viewId: "",
        dragId: COUNT_FIELD_ID,
        fid: COUNT_FIELD_ID,
        name: i18next.t('constant.row_count'),
        analyticType: 'measure',
        semanticType: 'quantitative',
        aggName: 'sum',
        computed: true,
        expression: {
            op: 'one',
            params: [],
            as: COUNT_FIELD_ID,
        },
    };
}

export function createVirtualFields(): IViewField[] {
    return [
        {
            dragId: MEA_KEY_ID,
            fid: MEA_KEY_ID,
            name: i18next.t('constant.mea_key'),
            analyticType: 'dimension',
            semanticType: 'nominal',
        },
        {
            dragId: MEA_VAL_ID,
            fid: MEA_VAL_ID,
            name: i18next.t('constant.mea_val'),
            analyticType: 'measure',
            semanticType: 'quantitative',
            aggName: 'sum',
        },
    ];
}

export function getRange(nums: number[]): [number, number] {
    let _min = Infinity;
    let _max = -Infinity;
    for (let i = 0; i < nums.length; i++) {
        _min = Math.min(_min, nums[i]);
        _max = Math.max(_max, nums[i]);
    }
    return [_min, _max];
}

export function makeNumbersBeautiful(nums: number[]): number[] {
    const [min, max] = getRange(nums);
    const range = max - min;
    const step = Math.pow(10, Math.floor(Math.log10(range)));
    return nums.map((num) => {
        return Math.round(num / step) * step;
    });
}

export function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export function getMeaAggName(meaName: string, agg?: string | undefined) {
    if (!agg || agg === 'expr') {
        return meaName;
    }
    return `${agg}(${meaName})`;
}

export function getMeaAggKey(meaKey: string, agg?: string | undefined) {
    if (!agg || agg === 'expr') {
        return meaKey;
    }
    return `${meaKey}_${agg}`;
}
export function getFilterMeaAggKey(field: IFilterField) {
    return field.enableAgg && field.aggName ? getMeaAggKey(field.fid, field.aggName) : field.fid;
}
export function getSort({ rows, columns }: { rows: readonly IViewField[]; columns: readonly IViewField[] }) {
    if (rows.length && !rows.find((x) => x.analyticType === 'measure')) {
        return rows[rows.length - 1].sort || 'none';
    }
    if (columns.length && !columns.find((x) => x.analyticType === 'measure')) {
        return columns[columns.length - 1].sort || 'none';
    }
    return 'none';
}

export function getSortedEncoding({ rows, columns }: { rows: readonly IViewField[]; columns: readonly IViewField[] }) {
    if (rows.length && !rows.find((x) => x.analyticType === 'measure')) {
        return 'row';
    }
    if (columns.length && !columns.find((x) => x.analyticType === 'measure')) {
        return 'column';
    }
    return 'none';
}

const defaultValueComparator = (a: any, b: any) => {
    if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    } else {
        return String(a).localeCompare(String(b));
    }
};

export function parseCmpFunction(str?: string): (a: any, b: any) => number {
    return defaultValueComparator;
}

export function parseErrorMessage(errorLike: any): string {
    if (errorLike instanceof Error) {
        return errorLike.message;
    }
    if (typeof errorLike === 'string') {
        return errorLike;
    }
    return String(errorLike);
}

export const formatDate = (date: Date) => {
    const Y = date.getFullYear();
    const M = date.getMonth() + 1;
    const D = date.getDate();
    const H = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    const pad = (x: number) => `${x}`.padStart(2, '0');
    return `${Y}-${pad(M)}-${pad(D)} ${pad(H)}:${pad(m)}:${pad(s)}`;
};
