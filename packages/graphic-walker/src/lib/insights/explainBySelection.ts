import { IAggregator, IExplainProps, IField } from '../../interfaces';
import { filterByPredicates, getMeaAggKey } from '../../utils';
import { compareDistribution, normalizeWithParent } from '../../utils/normalization';
import { aggregate } from '../op/aggregate';
import { complementaryFields, groupByAnalyticTypes } from './utils';

export function explainBySelection(props: IExplainProps) {
    const { metas, dataSource, viewFields, predicates } = props;
    const { dimensions: dimsInView, measures: measInView } = groupByAnalyticTypes(viewFields);
    const complementaryDimensions = complementaryFields({
        all: metas.filter((f) => f.analyticType === 'dimension'),
        selection: dimsInView,
    });
    const outlierList: Array<{ score: number; viiewFields: IField[] }> = complementaryDimensions.map(extendDim => {
        const overallData = aggregate(dataSource, {
            groupBy: [extendDim.fid],
            op: 'aggregate',
            measures: measInView.map((mea) => ({
                field: mea.fid,
                agg: (mea.aggName ?? 'sum') as IAggregator,
                asFieldKey: getMeaAggKey(mea.fid, (mea.aggName ?? 'sum') as IAggregator),
            })),
                
        });
        const viewData = aggregate(dataSource, {
            groupBy: dimsInView.map((f) => f.fid),
            op: 'aggregate',
            measures: measInView.map((mea) => ({
                field: mea.fid,
                agg: (mea.aggName ?? 'sum') as IAggregator,
                asFieldKey: getMeaAggKey(mea.fid, (mea.aggName ?? 'sum') as IAggregator),
            }))
        });
        const subData = filterByPredicates(viewData, predicates);

        let outlierNormalization = normalizeWithParent(
            subData,
            overallData,
            measInView.map((mea) => mea.fid),
            false
        );

        let outlierScore = compareDistribution(
            outlierNormalization.normalizedData,
            outlierNormalization.normalizedParentData,
            [extendDim.fid],
            measInView.map((mea) => mea.fid)
        );
        return {
            viiewFields: measInView.concat(extendDim),
            score: outlierScore,
        }
    }).sort((a, b) => b.score - a.score)
 
    return outlierList;
}
