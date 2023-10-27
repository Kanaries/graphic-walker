import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { LightBulbIcon } from "@heroicons/react/24/outline";
import { IGeographicData, IComputationFunction, ISegmentKey, IThemeKey, IMutField, IGeoDataItem, VegaGlobalConfig, IChannelScales, Specification, IDarkMode } from './interfaces';
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
import ClickMenu from './components/clickMenu';
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
import { GWGlobalConfig } from './vis/theme';
import { useCurrentMediaTheme } from './utils/media';
import { parseErrorMessage } from './utils';

export interface BaseVizProps {
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    themeKey?: IThemeKey;
    darkMode?: 'light' | 'dark';
    themeConfig?: GWGlobalConfig;
    toolbar?: {
        extra?: ToolbarItemProps[];
        exclude?: string[];
    };
    geographicData?: IGeographicData & {
        key: string;
    };
    enhanceAPI?: {
        header?: Record<string, string>;
        features?: {
            askviz?: string | boolean;
        };
    };
    dataSelection?: React.ReactChild;
    computation?: IComputationFunction;
    computationTimeout?: number;
    onError?: (err: Error) => void;
    geoList?: IGeoDataItem[];
    channelScales?: IChannelScales;
    spec?: Specification;
}

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
        onError
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

    const downloadCSVRef = useRef<{ download: () => void }>({download() {}});

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
        () =>
            computation
                ? withErrorReport(withTimeout(computation, computationTimeout), (err) => reportError(parseErrorMessage(err), 501))
                : async () => [],
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
                                {segmentKey === ISegmentKey.vis && <VisNav />}
                            </div>
                            {segmentKey === ISegmentKey.vis && (
                                <div style={{ marginTop: '0em', borderTop: 'none' }} className="m-4 p-4 border border-gray-200 dark:border-gray-700">
                                    {enhanceAPI?.features?.askviz && (
                                        <AskViz
                                            api={typeof enhanceAPI.features.askviz === 'string' ? enhanceAPI.features.askviz : ''}
                                            headers={enhanceAPI?.header}
                                        />
                                    )}
                                    <VisualSettings
                                        csvHandler={downloadCSVRef} rendererHandler={rendererRef}
                                        darkModePreference={darkMode}
                                        exclude={toolbar?.exclude}
                                        extra={toolbar?.extra}
                                    />
                                    <CodeExport />
                                    <ExplainData themeKey={themeKey} dark={darkMode} />
                                    <VisualConfig />
                                    <Errorpanel />
                                    <LogPanel />
                                    <BinPanel />
                                    {vizStore.showGeoJSONConfigPanel && <GeoConfigPanel geoList={props.geoList} />}
                                    <div className="sm:grid sm:grid-cols-12 xl:grid-cols-6">
                                        <div className="sm:col-span-3 xl:col-span-1">
                                            <DatasetFields />
                                        </div>
                                        <div className="sm:col-span-2 xl:col-span-1">
                                            <FilterField />
                                            <AestheticFields />
                                        </div>
                                        <div className="sm:col-span-7 xl:col-span-4">
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
                                                    <ReactiveRenderer csvRef={downloadCSVRef}
                                                        ref={rendererRef}
                                                        themeKey={themeKey}
                                                        dark={darkMode}
                                                        themeConfig={themeConfig}
                                                        computationFunction={wrappedComputation}
                                                        channelScales={props.channelScales}
                                                    />
                                                )}
                                                {vizEmbededMenu.show && (
                                                    <ClickMenu x={vizEmbededMenu.position[0]} y={vizEmbededMenu.position[1]}>
                                                        <div
                                                            className="flex items-center whitespace-nowrap py-1 px-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                                            onClick={() => {
                                                                vizStore.closeEmbededMenu();
                                                                vizStore.setShowInsightBoard(true);
                                                            }}
                                                        >
                                                            <span className="flex-1 pr-2">{t('App.labels.data_interpretation')}</span>
                                                            <LightBulbIcon className="ml-1 w-3 flex-grow-0 flex-shrink-0" />
                                                        </div>
                                                    </ClickMenu>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {segmentKey === ISegmentKey.data && (
                                <div className="m-4 p-4 border border-gray-200 dark:border-gray-700" style={{ marginTop: '0em', borderTop: 'none' }}>
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

export type VizProps = {
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    themeConfig?: GWGlobalConfig;
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    toolbar?: {
        extra?: ToolbarItemProps[];
        exclude?: string[];
    };
    geographicData?: IGeographicData & {
        key: string;
    };
    enhanceAPI?: {
        header?: Record<string, string>;
        features?: {
            askviz?: string | boolean;
        };
    };
    keepAlive?: boolean | string;
    storeRef?: React.MutableRefObject<VizSpecStore | null>;
    rawFields: IMutField[];
    onMetaChange?: (fid: string, meta: Partial<IMutField>) => void;
    computationTimeout?: number;
    dataSelection?: React.ReactChild;
    onError?: (err: Error) => void;
    geoList?: IGeoDataItem[];
    channelScales?: IChannelScales;
    spec?: Specification;
} & (
    | {
          /**
           * auto parse field key into a safe string. default is true
           */
          fieldKeyGuard?: boolean;
          dataSource: any[];
      }
    | {
          fieldKeyGuard?: undefined;
          dataSource?: undefined;
          computation: IComputationFunction;
      }
);

export function VizAppWithContext(props: VizProps) {
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
                        dataSelection={props.dataSelection}
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
