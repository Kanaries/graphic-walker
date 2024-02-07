import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
    IAppI18nProps,
    IVizProps,
    IErrorHandlerProps,
    IVizAppProps,
    ISpecProps,
    IComputationContextProps,
    IComputationProps,
    IComputationFunction,
    IFilterRule,
    IFilterField,
    IVisualLayout,
} from './interfaces';
import ReactiveRenderer from './renderer/index';
import { ComputationContext, VizStoreWrapper, useCompututaion, useVizStore, withErrorReport, withTimeout } from './store';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import { renderSpec } from './store/visualSpecStore';
import { guardDataKeys } from './utils/dataPrep';
import { getComputation } from './computation/clientComputation';
import { ErrorContext } from './utils/reportError';
import { ErrorBoundary } from 'react-error-boundary';
import Errorpanel from './components/errorpanel';
import { useCurrentMediaTheme } from './utils/media';
import { classNames, getFilterMeaAggKey, parseErrorMessage } from './utils';
import { VegaliteMapper } from './lib/vl2gw';
import { newChart } from './models/visSpecHistory';
import { SimpleOneOfSelector, SimpleRange, SimpleSearcher, SimpleTemporalRange } from './fields/filterField/simple';
import { toWorkflow } from './utils/workflow';
import { useResizeDetector } from 'react-resize-detector';
import { VizAppContext } from './store/context';

type BaseVizProps = IAppI18nProps &
    IVizProps &
    IErrorHandlerProps &
    ISpecProps &
    IComputationContextProps & {
        darkMode?: 'light' | 'dark';
        overrideSize?: IVisualLayout['size'];
        containerClassName?: string;
        containerStyle?: React.CSSProperties;
    };

const XL = 1280;
const MD = 768;

export const RendererApp = observer(function VizApp(props: BaseVizProps) {
    const {
        computation,
        darkMode = 'light',
        i18nLang = 'en-US',
        i18nResources,
        themeKey = 'vega',
        themeConfig,
        geographicData,
        computationTimeout = 60000,
        spec,
        vlSpec,
        chart,
        onError,
    } = props;

    const { i18n } = useTranslation();
    const curLang = i18n.language;

    useEffect(() => {
        if (i18nResources) {
            mergeLocaleRes(i18nResources);
        }
    }, [i18nResources]);

    useEffect(() => {
        if (i18nLang !== curLang) {
            setLocaleLanguage(i18nLang);
        }
    }, [i18nLang, curLang]);

    const vizStore = useVizStore();

    useEffect(() => {
        if (geographicData) {
            vizStore.setGeographicData(geographicData, geographicData.key);
        }
    }, [vizStore, geographicData]);

    useEffect(() => {
        if (spec) {
            vizStore.replaceNow(renderSpec(spec, vizStore.meta, vizStore.currentVis.name ?? 'Chart 1', vizStore.currentVis.visId));
        }
    }, [spec, vizStore]);

    useEffect(() => {
        if (chart) {
            vizStore.importCode(chart);
        }
    }, [chart, vizStore]);

    useEffect(() => {
        if (vlSpec) {
            const emptyChart = newChart(vizStore.meta, '');
            vizStore.replaceNow(
                VegaliteMapper(
                    spec,
                    [...emptyChart.encodings.dimensions, ...emptyChart.encodings.measures],
                    vizStore.currentVis.name ?? 'Chart 1',
                    vizStore.currentVis.visId
                )
            );
        }
    }, [vlSpec, vizStore]);

    const reportError = useCallback(
        (msg: string, code?: number) => {
            const err = new Error(`Error${code ? `(${code})` : ''}: ${msg}`);
            console.error(err);
            onError?.(err);
            if (code) {
                vizStore.updateShowErrorResolutionPanel(code, msg);
            }
        },
        [vizStore, onError]
    );

    const wrappedComputation = useMemo(
        () => (computation ? withErrorReport(withTimeout(computation, computationTimeout), (err) => reportError(parseErrorMessage(err), 501)) : async () => []),
        [reportError, computation, computationTimeout]
    );
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    return (
        <ErrorContext value={{ reportError }}>
            <ErrorBoundary fallback={<div>Something went wrong</div>} onError={props.onError}>
                <VizAppContext
                    ComputationContext={wrappedComputation}
                    themeContext={darkMode}
                    vegaThemeContext={{ themeConfig, themeKey }}
                    portalContainerContext={portal}
                >
                    <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-background text-foreground m-0 p-0`}>
                        <div className="flex flex-col space-y-2 bg-background text-foreground">
                            <Errorpanel />
                            <FilterSection />
                            <div className={props.containerClassName} style={props.containerStyle}>
                                {computation && (
                                    <ReactiveRenderer
                                        themeKey={themeKey}
                                        dark={darkMode}
                                        themeConfig={themeConfig}
                                        computationFunction={wrappedComputation}
                                        channelScales={props.channelScales}
                                        overrideSize={props.overrideSize}
                                    />
                                )}
                            </div>
                        </div>
                        <div ref={setPortal} />
                    </div>
                </VizAppContext>
            </ErrorBoundary>
        </ErrorContext>
    );
});

const FilterItem = observer(function FilterItem({ filter, onChange }: { filter: IFilterField; onChange: (rule: IFilterRule) => void }) {
    const vizStore = useVizStore();
    const { allFields, viewDimensions, config } = vizStore;
    const { timezoneDisplayOffset } = config;

    const computation = useCompututaion();

    const originalField = filter.enableAgg ? allFields.find((x) => x.fid === filter.fid) : undefined;
    const filterAggName = filter?.enableAgg ? filter.aggName : undefined;

    const transformedComputation = useMemo((): IComputationFunction => {
        if (originalField && viewDimensions.length > 0) {
            const preWorkflow = toWorkflow(
                [],
                allFields,
                viewDimensions,
                [{ ...originalField, aggName: filterAggName }],
                true,
                'none',
                [],
                undefined,
                timezoneDisplayOffset
            ).map((x) => {
                if (x.type === 'view') {
                    return {
                        ...x,
                        query: x.query.map((q) => {
                            if (q.op === 'aggregate') {
                                return { ...q, measures: q.measures.map((m) => ({ ...m, asFieldKey: m.field })) };
                            }
                            return q;
                        }),
                    };
                }
                return x;
            });
            return (query) =>
                computation({
                    ...query,
                    workflow: preWorkflow.concat(query.workflow.filter((x) => x.type !== 'transform')),
                });
        } else {
            return computation;
        }
    }, [computation, viewDimensions, originalField, filterAggName]);

    return (
        <ComputationContext.Provider value={transformedComputation}>
            {filter.rule?.type === 'regexp' && (
                <SimpleSearcher
                    rawFields={allFields}
                    key={getFilterMeaAggKey(filter)}
                    field={filter}
                    onChange={onChange}
                    displayOffset={timezoneDisplayOffset}
                />
            )}
            {(filter.rule?.type === 'not in' || filter.rule?.type === 'one of') && (
                <SimpleOneOfSelector
                    rawFields={allFields}
                    key={getFilterMeaAggKey(filter)}
                    field={filter}
                    onChange={onChange}
                    displayOffset={timezoneDisplayOffset}
                />
            )}
            {filter.rule?.type === 'range' && (
                <SimpleRange rawFields={allFields} key={getFilterMeaAggKey(filter)} field={filter} onChange={onChange} displayOffset={timezoneDisplayOffset} />
            )}
            {filter.rule?.type === 'temporal range' && (
                <SimpleTemporalRange
                    rawFields={allFields}
                    key={getFilterMeaAggKey(filter)}
                    field={filter}
                    onChange={onChange}
                    displayOffset={timezoneDisplayOffset}
                />
            )}
        </ComputationContext.Provider>
    );
});

const FilterSection = observer(function FilterSection() {
    const vizStore = useVizStore();

    const handleWriteFilter = React.useCallback(
        (index: number, rule: IFilterRule | null) => {
            if (index !== null) {
                vizStore.writeFilter(index, rule ?? null);
            }
        },
        [vizStore]
    );

    const { width = 0, ref } = useResizeDetector();

    const cols = width > XL ? 'grid-cols-3' : width > MD ? 'grid-cols-2' : 'grid-cols-1';

    return (
        <div className={classNames('grid gap-2 px-2', cols)} ref={ref}>
            {vizStore.viewFilters.map((filter, idx) => (
                <FilterItem key={filter.fid} filter={filter} onChange={(rule) => handleWriteFilter(idx, rule)} />
            ))}
        </div>
    );
});

export function RendererAppWithContext(
    props: IVizAppProps & IComputationProps & { overrideSize?: IVisualLayout['size']; containerClassName?: string; containerStyle?: React.CSSProperties }
) {
    const { dark, dataSource, computation, onMetaChange, fieldKeyGuard, keepAlive, storeRef, defaultConfig, ...rest } = props;

    const {
        computation: safeComputation,
        safeMetas,
        onMetaChange: safeOnMetaChange,
    } = useMemo(() => {
        if (props.dataSource) {
            if (props.fieldKeyGuard) {
                const { safeData, safeMetas } = guardDataKeys(props.dataSource, props.rawFields);
                return {
                    safeMetas,
                    computation: getComputation(safeData),
                    onMetaChange: (safeFID, meta) => {
                        const index = safeMetas.findIndex((x) => x.fid === safeFID);
                        if (index >= 0) {
                            props.onMetaChange?.(props.rawFields[index].fid, meta);
                        }
                    },
                };
            }
            return {
                safeMetas: props.rawFields,
                computation: getComputation(props.dataSource),
                onMetaChange: props.onMetaChange,
            };
        }
        return {
            safeMetas: props.rawFields,
            computation: props.computation,
            onMetaChange: props.onMetaChange,
        };
    }, [props.rawFields, props.dataSource ? props.dataSource : props.computation, props.fieldKeyGuard, props.onMetaChange]);

    const darkMode = useCurrentMediaTheme(props.dark);

    return (
        <VizStoreWrapper onMetaChange={safeOnMetaChange} meta={safeMetas} keepAlive={keepAlive} storeRef={storeRef} defaultConfig={defaultConfig}>
            <RendererApp {...rest} darkMode={darkMode} computation={safeComputation} />
        </VizStoreWrapper>
    );
}
