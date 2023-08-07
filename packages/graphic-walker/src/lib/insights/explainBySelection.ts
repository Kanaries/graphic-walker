import { IAggregator, IExplainProps, IField, IRow } from '../../interfaces';
import { filterByPredicates, getMeaAggKey } from '../../utils';
import { compareDistribution, compareDistributionKL, normalizeWithParent } from '../../utils/normalization';
import { IBinQuery } from '../interfaces';
import { aggregate } from '../op/aggregate';
import { bin } from '../op/bin';
import { complementaryFields, groupByAnalyticTypes } from './utils';

const QUANT_BIN_NUM = 10;

export function explainBySelection(props: IExplainProps) {
    const { metas, dataSource, viewFields, predicates } = props;
    const { dimensions: dimsInView, measures: measInView } = groupByAnalyticTypes(viewFields);
    const complementaryDimensions = complementaryFields({
        all: metas.filter((f) => f.analyticType === 'dimension'),
        selection: dimsInView,
    });
    const outlierList: { 
        score: number; 
        measureField: IField; 
        targetField: IField; 
        normalizedData: IRow[]; 
        normalizedParentData: IRow[];
    }[] = complementaryDimensions.map(extendDim => {
        let dataSource_ = dataSource;
        let extendDimFid = extendDim.fid
        if (extendDim.semanticType === "quantitative") {
            extendDimFid = `${extendDim.fid}_bin`;
            dataSource_ = bin(dataSource, {
                binBy: extendDim.fid,
                binSize: QUANT_BIN_NUM,
                newBinCol: extendDimFid
            } as IBinQuery);
        }

        const overallData = aggregate(dataSource_, {
            groupBy:[extendDimFid],
            op: 'aggregate',
            measures: measInView.map((mea) => ({
                field: mea.fid,
                agg: (mea.aggName ?? 'sum') as IAggregator,
                asFieldKey: getMeaAggKey(mea.fid, (mea.aggName ?? 'sum') as IAggregator),
            })),
                
        });
        const viewData = aggregate(dataSource_, {
            groupBy: [...dimsInView.map((f) => f.fid), extendDimFid],
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
            measInView.map((mea) => getMeaAggKey(mea.fid, (mea.aggName ?? 'sum') as IAggregator)),
            false
        );

        let outlierScore = compareDistributionKL(
            outlierNormalization.normalizedData,
            outlierNormalization.normalizedParentData,
            [extendDim.fid],
            measInView.map((mea) => getMeaAggKey(mea.fid, (mea.aggName ?? 'sum') as IAggregator))
        );
        return {
            measureField: measInView[0],
            targetField: extendDim,
            score: outlierScore,
            normalizedData: subData,
            normalizedParentData: overallData
        }
    }).sort((a, b) => b.score - a.score);
    return outlierList;
}
