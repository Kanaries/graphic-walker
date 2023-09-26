import { IAggregator, IExplainProps, IPredicate, IField, IRow, IViewField, IFilterField, IComputationFunction, IViewWorkflowStep } from '../../interfaces';
import { filterByPredicates, getMeaAggKey } from '../../utils';
import { compareDistribution, compareDistributionKL, compareDistributionJS, normalizeWithParent } from '../../utils/normalization';
import { IBinQuery } from '../interfaces';
import { aggregate } from '../op/aggregate';
import { bin } from '../op/bin';
import { VizSpecStore } from "../../store/visualSpecStore";
import { complementaryFields, groupByAnalyticTypes } from './utils';
import { toWorkflow } from '../../utils/workflow';
import { dataQueryServer } from '../../computation/serverComputation';

const QUANT_BIN_NUM = 10;

export async function explainBySelection(props: {
    predicates: IPredicate[],
    viewFilters: VizSpecStore['viewFilters'],
    allFields: IViewField[],
    viewMeasures: IViewField[],
    viewDimensions: IViewField[],
    computationFunction: IComputationFunction
}) {
    const { allFields, viewFilters, viewMeasures, viewDimensions, predicates, computationFunction } = props;
    const complementaryDimensions = complementaryFields({
        all: allFields.filter((f) => f.analyticType === 'dimension'),
        selection: viewDimensions,
    });
    const outlierList: { 
        score: number; 
        measureField: IField; 
        targetField: IField; 
        normalizedData: IRow[]; 
        normalizedParentData: IRow[];
    }[] = [];
    for (let extendDim of complementaryDimensions) {
        let extendDimFid = extendDim.fid;
        let extraPreWorkflow: IViewWorkflowStep[] = [];
        if (extendDim.semanticType === "quantitative") {
            extraPreWorkflow.push({
                type: "view",
                query: [
                    {
                        op: "bin",
                        binBy: extendDim.fid,
                        binSize: QUANT_BIN_NUM,
                        newBinCol: extendDimFid
                    }
                ]
            })
        }
        for (let mea of viewMeasures) {
            const overallWorkflow = toWorkflow(viewFilters, allFields, [extendDim], [mea], true, 'none');
            const fullOverallWorkflow = extraPreWorkflow ? [...extraPreWorkflow, ...overallWorkflow] : overallWorkflow
            const overallData = await dataQueryServer(computationFunction, fullOverallWorkflow)
            const viewWorkflow = toWorkflow(viewFilters, allFields, [...viewDimensions, extendDim], [mea], true, 'none');
            const fullViewWorkflow = extraPreWorkflow ? [...extraPreWorkflow, ...viewWorkflow] : viewWorkflow
            const viewData = await dataQueryServer(computationFunction, fullViewWorkflow);
            const subData = filterByPredicates(viewData, predicates);
            let outlierNormalization = normalizeWithParent(
                subData,
                overallData,
                [getMeaAggKey(mea.fid, (mea.aggName ?? 'sum'))],
                false
            );
            let outlierScore = compareDistributionJS(
                outlierNormalization.normalizedData,
                outlierNormalization.normalizedParentData,
                [extendDim.fid],
                getMeaAggKey(mea.fid, (mea.aggName ?? 'sum'))
            );
            outlierList.push(
                {
                    measureField: mea,
                    targetField: extendDim,
                    score: outlierScore,
                    normalizedData: subData,
                    normalizedParentData: overallData
                }
            )
        }
    }
    return outlierList.sort((a, b) => b.score - a.score);
}
