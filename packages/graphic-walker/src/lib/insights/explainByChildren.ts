import { IMeasure, IRow } from '../../interfaces';
import { IPredicate, checkChildOutlier, checkMajorFactor, filterByPredicates, getMeaAggKey } from '../../utils';
import { aggregate } from '../op/aggregate';

export function explainByChildren(
    dataSource: IRow[],
    predicates: IPredicate[],
    dimensions: string[],
    measures: IMeasure[]
) {
    // 1. find most relative dimensions(topK)
    // 2. for each dimension, we check all the dim member in it. find the member whos distribution is most close to current one.
    // here we do not nomorlize all the dim member's distribution, we use the relative distribution instead.
    // 3. the dim member we found can be used to explain current one as major factor.
    // const predicates: IPredicate[] = selection === 'all' ? [] : getPredicates(selection, dimensions, []);
    const viewData = aggregate(dataSource, {
        groupBy: dimensions,
        op: 'aggregate',
        measures: measures.map(mea => ({
            field: mea.key,
            agg: mea.op,
            asFieldKey: getMeaAggKey(mea.key, mea.op)
        }))
    });
    const measureIds = measures.map((m) => m.key);
    const parentData = filterByPredicates(viewData, predicates);

    const majorList: Array<{ key: string; score: number; dimensions: string[]; measures: IMeasure[] }> = [];
    const outlierList: Array<{ key: string; score: number; dimensions: string[]; measures: IMeasure[] }> = [];
    for (let extendDim of dimensions) {
        const data = aggregate(dataSource, {
            groupBy: dimensions.concat(extendDim),
            op: 'aggregate',
            measures: measures.map((mea) => ({
                field: mea.key,
                agg: mea.op,
                asFieldKey: getMeaAggKey(mea.key, mea.op),
            }))
        });
        let groups: Map<any, IRow[]> = new Map();
        for (let record of data) {
            if (!groups.has(record[extendDim])) {
                groups.set(record[extendDim], []);
            }
            groups.get(record[extendDim])?.push(record);
        }
        const { majorKey, majorSum } = checkMajorFactor(parentData, groups, dimensions, measureIds);
        majorList.push({ key: majorKey, score: majorSum, dimensions: [extendDim], measures });
        const { outlierKey, outlierSum } = checkChildOutlier(parentData, groups, dimensions, measureIds);
        outlierList.push({ key: outlierKey, score: outlierSum, dimensions: [extendDim], measures });
    }
    majorList.sort((a, b) => a.score - b.score);
    outlierList.sort((a, b) => b.score - a.score);
    return {
        majorList,
        outlierList,
    };
}
