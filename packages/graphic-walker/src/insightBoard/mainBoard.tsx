import React, { useEffect, useState, useMemo, useRef } from "react";
import embed from "vega-embed";
import { Insight, Utils, UnivariateSummary } from "visual-insights";
import ReactJson from "react-json-view";
import { IField, Filters, IMeasure, IRow } from "../interfaces";
import { IExplaination, IMeasureWithStat } from "../insights";
import { getExplaination, IVisSpace } from "../services";
import { baseVis, IReasonType } from "./std2vegaSpec";
import RadioGroupButtons from "./radioGroupButtons";
import { formatFieldName, mergeMeasures } from "./utils";
import { useTranslation } from "react-i18next";

const collection = Insight.IntentionWorkerCollection.init();

enum IReasonTypes {
    selection_dim_distribution = "selection_dim_distribution",
    selection_mea_distribution = "selection_mea_distribution",
    children_major_factor = "children_major_factor",
    children_outlier = "children_outlier",
}

collection.enable(Insight.DefaultIWorker.cluster, false);
interface SubSpace {
    dimensions: string[];
    measures: IMeasure[];
}

interface InsightMainBoardProps {
    dataSource: IRow[];
    fields: Readonly<IField[]>;
    filters?: Filters;
    viewDs: IField[];
    viewMs: IField[];
}
const InsightMainBoard: React.FC<InsightMainBoardProps> = (props) => {
    const { dataSource, fields, viewDs, viewMs, filters } = props;
    const [recSpaces, setRecSpaces] = useState<IExplaination[]>([]);
    const [visSpaces, setVisSpaces] = useState<IVisSpace[]>([]);
    const [visIndex, setVisIndex] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [valueExp, setValueExp] = useState<IMeasureWithStat[]>([]);
    const { t } = useTranslation();
    const container = useRef<HTMLDivElement>(null);

    const dimsWithTypes = useMemo(() => {
        const dimensions = fields
            .filter((f) => f.analyticType === "dimension")
            .map((f) => f.fid)
            .filter((f) => !Utils.isFieldUnique(dataSource, f));
        return UnivariateSummary.getAllFieldTypes(dataSource, dimensions);
    }, [fields, dataSource]);

    const measWithTypes = useMemo(() => {
        const measures = fields.filter((f) => f.analyticType === "measure").map((f) => f.fid);
        return measures.map((m) => ({
            name: m,
            type: "quantitative",
        }));
    }, [fields]);

    useEffect(() => {
        if (dimsWithTypes.length > 0 && measWithTypes.length > 0 && dataSource.length > 0) {
            const measures = fields.filter((f) => f.analyticType === "measure").map((f) => f.fid);
            const dimensions = dimsWithTypes.map((d) => d.name);
            const currentSpace: SubSpace = {
                dimensions: viewDs.map((f) => f.fid),
                measures: viewMs.map((f) => ({
                    key: f.fid,
                    op: f.aggName as any,
                })),
            };
            setLoading(true);

            getExplaination({
                dimensions,
                measures,
                dataSource,
                currentSpace,
                filters,
            }).then(({ visSpaces, explainations, valueExp }) => {
                setRecSpaces(explainations);
                setVisSpaces(visSpaces);
                setValueExp(valueExp);
                setLoading(false);
            });
        }
    }, [fields, viewDs, viewMs, measWithTypes, filters, dimsWithTypes, measWithTypes, dataSource]);

    useEffect(() => {
        const RecSpace = recSpaces[visIndex];
        const visSpec = visSpaces[visIndex];
        if (container.current && RecSpace && visSpec) {
            const usePredicates: boolean =
                RecSpace.type === "selection_dim_distribution" || RecSpace.type === "selection_mea_distribution";
            const mergedMeasures = mergeMeasures(RecSpace.measures, RecSpace.extendMs);
            const _vegaSpec = baseVis(
                visSpec.schema,
                visSpec.schema.geomType && visSpec.schema.geomType[0] === "point" ? dataSource : visSpec.dataView,
                // result.aggData,
                [...RecSpace.dimensions, ...RecSpace.extendDs],
                [...RecSpace.measures, ...RecSpace.extendMs].map((m) => m.key),
                usePredicates ? RecSpace.predicates : null,
                mergedMeasures.map((m) => ({
                    op: m.op,
                    field: m.key,
                    as: m.key,
                })),
                fields,
                RecSpace.type as IReasonType,
                true,
                true
            );
            if (container.current) {
                embed(container.current, _vegaSpec);
            }
        }
    }, [visIndex, recSpaces, visSpaces, fields, dataSource]);

    const FilterDesc = useMemo<React.ReactElement[]>(() => {
        if (filters) {
            const dimValues = Object.keys(filters)
                .filter((k) => filters[k].length > 0)
                .map((k, ki) => {
                    return (
                        <div key={`dim-${ki}`}>
                            <div className="inline bg-gray-400 py-0.5 px-2 mx-2 rounded-full underline text-white">
                                {formatFieldName(k, fields)}
                            </div>
                            <div className="inline text-lg ml-1 mr-1">=</div>
                            <div className="inline bg-blue-600 py-0.5 px-2 mx-2 rounded-full text-white">{filters[k]}</div>
                        </div>
                    );
                });
            return dimValues;
        }
        return [];
    }, [filters]);

    const valueDesc = useMemo<React.ReactElement[]>(() => {
        const meaStatus = valueExp.map((mea, mi) => (
            <div key={`mea-${mi}`}>
                <span className="bg-gray-400 py-0.5 px-2 mx-2 rounded-full underline text-white">
                    {formatFieldName(mea.key, fields)}({mea.op})
                </span>
                <span className="bg-red-500 py-0.5 px-2 mx-2 rounded-full text-white">
                    {mea.score === 1 ? t("explain.lg_than") : t("explain.sm_than")}
                </span>
                <span>{t("explain.expection")}{" "}</span>
            </div>
        ));
        return meaStatus;
    }, [valueExp]);

    return (
        <div style={{ maxHeight: "80vh", minHeight: "200px", overflowY: "auto", maxWidth: "880px" }}>
            <div className="text-xs">{FilterDesc}</div>
            <div className="text-xs mt-2 mb-2">{valueDesc}</div>
            {loading && (
                <div className="animate-spin inline-block mr-2 ml-2 w-16 h-16 rounded-full border-t-2 border-l-2 border-blue-500"></div>
            )}
            <div style={{ display: "flex" }}>
                <div style={{ flexBasis: "200px", flexShrink: 0, maxHeight: "800px", overflowY: "auto" }}>
                    <RadioGroupButtons
                        choosenIndex={visIndex}
                        options={recSpaces.map((s, i) => ({
                            value: s.type || "" + i,
                            label: `${
                                s.type ? t(`explain.reason.${IReasonTypes[s.type]}`) : t("explain.unrecognized")
                            }: ${s.score.toFixed(2)}`,
                        }))}
                        onChange={(v, i) => {
                            setVisIndex(i);
                        }}
                    />
                </div>
                <div className="p-4 text-sm">
                    <div ref={container}></div>
                    {recSpaces[visIndex] && (
                        <div>
                            {t("constant.analytic_type.dimension")} = 
                            {recSpaces[visIndex].dimensions.map((f) => formatFieldName(f, fields)).join(", ")}
                            <br />
                            {t("constant.analytic_type.measure")} = 
                            {recSpaces[visIndex].measures
                                .map((m) => m.key)
                                .map((f) => formatFieldName(f, fields))
                                .join(", ")}
                            <br />
                            {" " + t("explain.contains") + " "}
                            {recSpaces[visIndex].type
                                ? t(`explain.reason.${IReasonTypes[recSpaces[visIndex].type]}`)
                                : t("explain.unrecognized")}{" "}
                            ，{t("explain.score")}
                            {recSpaces[visIndex].score}
                            <br />
                            {recSpaces[visIndex].description &&
                                recSpaces[visIndex].description.intMeasures &&
                                FilterDesc +
                                    recSpaces[visIndex].description.intMeasures
                                        .map(
                                            (mea: any) =>
                                                `${formatFieldName(mea.key, fields)}(${mea.op})}${
                                                    mea.score === 1 ? t("explain.lg_than") : t("explain.sm_than")
                                                }${t("explain.expection")}`
                                        )
                                        .join(", ")}
                            <br />
                            <ReactJson src={recSpaces[visIndex].description} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InsightMainBoard;
