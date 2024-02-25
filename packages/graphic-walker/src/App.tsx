import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ISegmentKey, IAppI18nProps, IVizProps, IErrorHandlerProps, IVizAppProps, ISpecProps, IComputationContextProps, IComputationProps } from './interfaces';
import type { IReactVegaHandler } from './vis/react-vega';
import VisualSettings from './visualSettings';
import PosFields from './fields/posFields';
import AestheticFields from './fields/aestheticFields';
import DatasetFields from './fields/datasetFields/index';
import ReactiveRenderer from './renderer/index';
import { VizStoreWrapper, useVizStore, withErrorReport, withTimeout } from './store';
import VisNav from './segments/visNav';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import FilterField from './fields/filterField';
import DatasetConfig from './dataSource/datasetConfig';
import CodeExport from './components/codeExport';
import VisualConfig from './components/visualConfig';
import ExplainData from './components/explainData';
import GeoConfigPanel from './components/leafletRenderer/geoConfigPanel';
import AskViz from './components/askViz';
import { renderSpec } from './store/visualSpecStore';
import FieldsContextWrapper from './fields/fieldsContext';
import { guardDataKeys } from './utils/dataPrep';
import { getComputation } from './computation/clientComputation';
import LogPanel from './fields/datasetFields/logPanel';
import BinPanel from './fields/datasetFields/binPanel';
import { ErrorContext } from './utils/reportError';
import { ErrorBoundary } from 'react-error-boundary';
import Errorpanel from './components/errorpanel';
import { useCurrentMediaTheme } from './utils/media';
import Painter from './components/painter';
import { classNames, parseErrorMessage } from './utils';
import { VizEmbedMenu } from './components/embedMenu';
import DataBoard from './components/dataBoard';
import SideResize from './components/side-resize';
import { VegaliteMapper } from './lib/vl2gw';
import { newChart } from './models/visSpecHistory';
import ComputedFieldDialog from './components/computedField';
import { VizAppContext } from './store/context';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { ChartPieIcon, CircleStackIcon } from '@heroicons/react/24/outline';
import { TabsContent } from '@radix-ui/react-tabs';

export type BaseVizProps = IAppI18nProps &
    IVizProps &
    IErrorHandlerProps &
    ISpecProps &
    IComputationContextProps & {
        darkMode?: 'light' | 'dark';
    };

export const VizApp = observer(function VizApp(props: BaseVizProps) {
    const {
        computation,
        darkMode = 'light',
        i18nLang = 'en-US',
        enhanceAPI,
        i18nResources,
        themeKey = 'vega',
        themeConfig,
        toolbar,
        geographicData,
        computationTimeout = 60000,
        spec,
        chart,
        vlSpec,
        onError,
    } = props;

    const { t, i18n } = useTranslation();
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

    const rendererRef = useRef<IReactVegaHandler>(null);

    const downloadCSVRef = useRef<{ download: () => void }>({ download() {} });

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

    const { segmentKey, vizEmbededMenu } = vizStore;

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
                    <div className={classNames(`App font-sans bg-background text-foreground m-0 p-0`, darkMode === 'dark' ? 'dark' : '')}>
                        <FieldsContextWrapper>
                            <div className="bg-background text-foreground">
                                <Errorpanel />
                                <Tabs value={segmentKey} onValueChange={(v) => vizStore.setSegmentKey(v as ISegmentKey)}>
                                    <TabsList className="mx-4">
                                        <TabsTrigger value={ISegmentKey.data}>
                                            <CircleStackIcon className="w-4 mr-2" /> {t('App.segments.data')}
                                        </TabsTrigger>
                                        <TabsTrigger value={ISegmentKey.vis}>
                                            <ChartPieIcon className="w-4 mr-2" /> {t('App.segments.vis')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value={ISegmentKey.data}>
                                        <div className="mx-4 -mt-px p-4 border rounded-md rounded-t-none">
                                            <DatasetConfig />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value={ISegmentKey.vis}>
                                        <div className="px-2 mx-2 mt-2">
                                            <VisNav />
                                        </div>
                                        <div style={{ marginTop: '0em' }} className="m-4 p-4 border border-border rounded-md rounded-tl-none">
                                            {enhanceAPI?.features?.askviz && (
                                                <AskViz
                                                    api={typeof enhanceAPI.features.askviz === 'boolean' ? '' : enhanceAPI.features.askviz}
                                                    feedbackApi={
                                                        typeof enhanceAPI.features.feedbackAskviz === 'boolean' ? '' : enhanceAPI.features.feedbackAskviz
                                                    }
                                                    headers={enhanceAPI?.header}
                                                />
                                            )}
                                            <VisualSettings
                                                csvHandler={downloadCSVRef}
                                                rendererHandler={rendererRef}
                                                darkModePreference={darkMode}
                                                experimentalFeatures={props.experimentalFeatures}
                                                exclude={toolbar?.exclude}
                                                extra={toolbar?.extra}
                                            />
                                            <CodeExport />
                                            <ExplainData themeKey={themeKey} />
                                            {vizStore.showDataBoard && <DataBoard />}
                                            <VisualConfig />
                                            <LogPanel />
                                            <BinPanel />
                                            <ComputedFieldDialog />
                                            <Painter themeConfig={themeConfig} themeKey={themeKey} />
                                            {vizStore.showGeoJSONConfigPanel && <GeoConfigPanel geoList={props.geoList} />}
                                            <div className="sm:flex">
                                                <SideResize
                                                    defaultWidth={240}
                                                    handleWidth={4}
                                                    className="min-w-[100%] max-w-full sm:min-w-[96px] sm:max-w-[35%] flex-shrink-0"
                                                    handlerClassName="hidden sm:block"
                                                >
                                                    <DatasetFields />
                                                </SideResize>
                                                <SideResize
                                                    defaultWidth={180}
                                                    handleWidth={4}
                                                    className="min-w-[100%] max-w-full sm:min-w-[120px] sm:max-w-[30%] flex-shrink-0"
                                                    handlerClassName="hidden sm:block"
                                                >
                                                    <FilterField />
                                                    <AestheticFields />
                                                </SideResize>
                                                <div className="flex-1 min-w-[0px]">
                                                    <div>
                                                        <PosFields />
                                                    </div>
                                                    <div
                                                        className="my-0.5 sm:ml-0.5 p-1 border relative"
                                                        style={{ minHeight: '600px', height: 1, maxHeight: '100vh', overflow: 'auto' }}
                                                        onMouseLeave={() => {
                                                            vizEmbededMenu.show && vizStore.closeEmbededMenu();
                                                        }}
                                                        onClick={() => {
                                                            vizEmbededMenu.show && vizStore.closeEmbededMenu();
                                                        }}
                                                    >
                                                        {computation && (
                                                            <ReactiveRenderer
                                                                csvRef={downloadCSVRef}
                                                                ref={rendererRef}
                                                                themeKey={themeKey}
                                                                dark={darkMode}
                                                                themeConfig={themeConfig}
                                                                computationFunction={wrappedComputation}
                                                                channelScales={props.channelScales}
                                                            />
                                                        )}
                                                        <VizEmbedMenu />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </FieldsContextWrapper>
                        <div ref={setPortal} />
                    </div>
                </VizAppContext>
            </ErrorBoundary>
        </ErrorContext>
    );
});

export function VizAppWithContext(props: IVizAppProps & IComputationProps) {
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
            <VizApp darkMode={darkMode} computation={safeComputation} {...rest} />
        </VizStoreWrapper>
    );
}
