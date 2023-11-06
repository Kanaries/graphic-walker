import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
    ISegmentKey,
    IAppI18nProps,
    IVizProps,
    IErrorHandlerProps,
    IVizAppProps,
    ISpecProps,
    IComputationContextProps,
} from './interfaces';
import type { IReactVegaHandler } from './vis/react-vega';
import VisualSettings from './visualSettings';
import PosFields from './fields/posFields';
import AestheticFields from './fields/aestheticFields';
import DatasetFields from './fields/datasetFields/index';
import ReactiveRenderer from './renderer/index';
import { ComputationContext, VizStoreWrapper, useVizStore, withErrorReport, withTimeout } from './store';
import VisNav from './segments/visNav';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import FilterField from './fields/filterField';
import SegmentNav from './segments/segmentNav';
import DatasetConfig from './dataSource/datasetConfig';
import CodeExport from './components/codeExport';
import VisualConfig from './components/visualConfig';
import ExplainData from './components/explainData';
import GeoConfigPanel from './components/leafletRenderer/geoConfigPanel';
import type { ToolbarItemProps } from './components/toolbar';
import AskViz from './components/askViz';
import { VizSpecStore, renderSpec } from './store/visualSpecStore';
import FieldsContextWrapper from './fields/fieldsContext';
import { guardDataKeys } from './utils/dataPrep';
import { getComputation } from './computation/clientComputation';
import LogPanel from './fields/datasetFields/logPanel';
import BinPanel from './fields/datasetFields/binPanel';
import { ErrorContext } from './utils/reportError';
import { ErrorBoundary } from 'react-error-boundary';
import Errorpanel from './components/errorpanel';
import { useCurrentMediaTheme } from './utils/media';
import { parseErrorMessage } from './utils';
import { VizEmbedMenu } from './components/embedMenu';
import DataBoard from './components/dataBoard';
import SideReisze from './components/side-resize';

export type BaseVizProps = IAppI18nProps &
    IVizProps &
    IErrorHandlerProps &
    ISpecProps &
    IComputationContextProps & {
        darkMode?: 'light' | 'dark';
        dataSelection?: React.ReactChild;
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
    return (
        <ErrorContext value={{ reportError }}>
            <ErrorBoundary fallback={<div>Something went wrong</div>} onError={props.onError}>
                <ComputationContext.Provider value={wrappedComputation}>
                    <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-white dark:bg-zinc-900 dark:text-white m-0 p-0`}>
                        <div className="bg-white dark:bg-zinc-900 dark:text-white">
                            {props.dataSelection}
                            <div className="px-2 mx-2">
                                <SegmentNav />
                            </div>
                            {segmentKey === ISegmentKey.vis && (
                                <div className="px-2 mx-2 mt-2">
                                    <VisNav />
                                </div>
                            )}

                            {segmentKey === ISegmentKey.vis && (
                                <div style={{ marginTop: '0em', borderTop: 'none' }} className="m-4 p-4 border border-gray-200 dark:border-gray-700">
                                    {enhanceAPI?.features?.askviz && (
                                        <AskViz
                                            api={typeof enhanceAPI.features.askviz === 'string' ? enhanceAPI.features.askviz : ''}
                                            feedbackApi={typeof enhanceAPI.features.feedbackAskviz === 'string' ? enhanceAPI.features.feedbackAskviz : ''}
                                            headers={enhanceAPI?.header}
                                        />
                                    )}
                                    <VisualSettings
                                        csvHandler={downloadCSVRef}
                                        rendererHandler={rendererRef}
                                        darkModePreference={darkMode}
                                        exclude={toolbar?.exclude}
                                        extra={toolbar?.extra}
                                    />
                                    <CodeExport />
                                    <ExplainData themeKey={themeKey} dark={darkMode} />
                                    <DataBoard />
                                    <VisualConfig />
                                    <Errorpanel />
                                    <LogPanel />
                                    <BinPanel />
                                    {vizStore.showGeoJSONConfigPanel && <GeoConfigPanel geoList={props.geoList} />}
                                    <div className="sm:flex">
                                        <SideReisze
                                            defaultWidth={240}
                                            handleWidth={4}
                                            className="min-w-[100%] max-w-full sm:min-w-[96px] sm:max-w-[35%] flex-shrink-0"
                                            handlerClassName="hidden sm:block"
                                        >
                                            <DatasetFields />
                                        </SideReisze>
                                        <SideReisze
                                            defaultWidth={180}
                                            handleWidth={4}
                                            className="min-w-[100%] max-w-full sm:min-w-[120px] sm:max-w-[30%] flex-shrink-0"
                                            handlerClassName="hidden sm:block"
                                        >
                                            <FilterField />
                                            <AestheticFields />
                                        </SideReisze>
                                        <div className="flex-1">
                                            <div>
                                                <PosFields />
                                            </div>
                                            <div
                                                className="m-0.5 p-1 border border-gray-200 dark:border-gray-700"
                                                style={{ minHeight: '600px', overflow: 'auto' }}
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
                            )}
                            {segmentKey === ISegmentKey.data && (
                                <div className="mx-4 p-4 border border-gray-200 dark:border-gray-700" style={{ marginTop: '0em', borderTop: 'none' }}>
                                    <DatasetConfig />
                                </div>
                            )}
                        </div>
                    </div>
                </ComputationContext.Provider>
            </ErrorBoundary>
        </ErrorContext>
    );
});

export function VizAppWithContext(props: IVizAppProps) {
    const { computation, safeMetas } = useMemo(() => {
        if (props.dataSource) {
            if (props.fieldKeyGuard) {
                const { safeData, safeMetas } = guardDataKeys(props.dataSource, props.rawFields);
                return {
                    safeMetas,
                    computation: getComputation(safeData),
                };
            }
            return {
                safeMetas: props.rawFields,
                computation: getComputation(props.dataSource),
            };
        }
        return {
            safeMetas: props.rawFields,
            computation: props.computation,
        };
    }, [props.rawFields, props.dataSource ? props.dataSource : props.computation, props.fieldKeyGuard]);

    const darkMode = useCurrentMediaTheme(props.dark);

    return (
        <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-white dark:bg-zinc-900 dark:text-white m-0 p-0`}>
            <VizStoreWrapper onMetaChange={props.onMetaChange} meta={safeMetas} keepAlive={props.keepAlive} storeRef={props.storeRef}>
                <FieldsContextWrapper>
                    <VizApp
                        darkMode={darkMode}
                        enhanceAPI={props.enhanceAPI}
                        i18nLang={props.i18nLang}
                        i18nResources={props.i18nResources}
                        themeKey={props.themeKey}
                        toolbar={props.toolbar}
                        computation={computation}
                        computationTimeout={props.computationTimeout}
                        channelScales={props.channelScales}
                        geoList={props.geoList}
                        geographicData={props.geographicData}
                        onError={props.onError}
                        spec={props.spec}
                        themeConfig={props.themeConfig}
                    />
                </FieldsContextWrapper>
            </VizStoreWrapper>
        </div>
    );
}
