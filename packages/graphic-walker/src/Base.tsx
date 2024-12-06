import React, { useEffect, useMemo, useCallback, useState, useContext, createContext } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
    ISegmentKey,
    IChart,
    IComputationFunction,
    IDarkMode,
    IDefaultConfig,
    IMutField,
    IThemeKey,
    IAskVizFeedback,
    IChatMessage,
    IViewField,
    IVisSpec,
} from './interfaces';
import VisualSettings from './visualSettings';
import PosFields from './fields/posFields';
import AestheticFields from './fields/aestheticFields';
import DatasetFields from './fields/datasetFields/index';
import ReactiveRenderer from './renderer/index';
import { ComputationContext, VizStoreWrapper, useVizStore, withErrorReport, withTimeout } from './store';
import VisNav from './segments/visNav';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import FilterField from './fields/filterField';
import DatasetConfig from './dataSource/datasetConfig';
import CodeExport from './components/codeExport';
import VisualConfig from './components/visualConfig';
import ExplainData from './components/explainData';
import GeoConfigPanel from './components/leafletRenderer/geoConfigPanel';
import AskViz from './components/askViz';
import { VizSpecStore } from './store/visualSpecStore';
import FieldsContextWrapper from './fields/fieldsContext';
import { getComputation } from './computation/clientComputation';
import LogPanel from './fields/datasetFields/logPanel';
import BinPanel from './fields/datasetFields/binPanel';
import RenamePanel from './components/renameField';
import { ErrorContext } from './utils/reportError';
import { ErrorBoundary } from 'react-error-boundary';
import Errorpanel from './components/errorpanel';
import { useCurrentMediaTheme } from './utils/media';
import Painter from './components/painter';
import { classNames, cn, parseErrorMessage } from './utils';
import { VizEmbedMenu } from './components/embedMenu';
import DataBoard from './components/dataBoard';
import SideResize from './components/side-resize';
import ComputedFieldDialog from './components/computedField';
import { VizAppContext } from './store/context';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { ChartPieIcon, CircleStackIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { TabsContent } from '@radix-ui/react-tabs';
import { VegaliteChat } from './components/chat';
import { GWGlobalConfig } from './vis/theme';
import { themeContext, vegaThemeContext } from './store/theme';
import { autorun } from 'mobx';

export interface IGraphicWalkerContextProps {
    data?: any[];
    appearance?: IDarkMode;
    fields?: IMutField[];
    onMetaChange?: (fid: string, meta: Partial<IMutField>) => void;
    computation?: IComputationFunction;
    storeRef?: React.MutableRefObject<VizSpecStore | null>;
    keepAlive?: boolean | string;
    defaultConfig?: IDefaultConfig;
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    vizThemeConfig?: IThemeKey | GWGlobalConfig;

    children?: React.ReactNode | Iterable<React.ReactNode>;
}

const VizApp = observer(function VizApp(props: {
    computation: IComputationFunction;
    computationTimeout?: number;
    darkMode?: 'light' | 'dark';
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    chart?: IChart[];
    children?: React.ReactNode | Iterable<React.ReactNode>;
}) {
    const { computation, computationTimeout = 60000, darkMode = 'light', i18nLang = 'en-US', i18nResources, chart, children } = props;

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
        if (chart) {
            vizStore.importCode(chart);
        }
    }, [chart, vizStore]);

    const reportError = useCallback(
        (msg: string, code?: number) => {
            const err = new Error(`Error${code ? `(${code})` : ''}: ${msg}`);
            console.error(err);
            if (code) {
                vizStore.updateShowErrorResolutionPanel(code, msg);
            }
        },
        [vizStore]
    );

    const wrappedComputation = useMemo(
        () => (computation ? withErrorReport(withTimeout(computation, computationTimeout), (err) => reportError(parseErrorMessage(err), 501)) : async () => []),
        [reportError, computation, computationTimeout]
    );

    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    return (
        <ErrorContext value={{ reportError }}>
            <ErrorBoundary fallback={<div>Something went wrong</div>}>
                <VizAppContext
                    ComputationContext={wrappedComputation}
                    themeContext={darkMode}
                    vegaThemeContext={{ vizThemeConfig: props.vizThemeConfig }}
                    portalContainerContext={portal}
                >
                    <div className={classNames(`App font-sans bg-background text-foreground m-0 p-0`, darkMode === 'dark' ? 'dark' : '')}>
                        <FieldsContextWrapper>{children}</FieldsContextWrapper>
                        <div ref={setPortal} />
                    </div>
                </VizAppContext>
            </ErrorBoundary>
        </ErrorContext>
    );
});

export const GraphicWalkerEditor = observer(function GraphicWalkerEditor({
    children,
    enhanceAPI,
}: {
    enhanceAPI?: {
        header?: Record<string, string>;
        features?: {
            askviz?: string | boolean | ((metas: IViewField[], query: string) => PromiseLike<IVisSpec | IChart> | IVisSpec | IChart);
            feedbackAskviz?: string | boolean | ((data: IAskVizFeedback) => void);
            vlChat?: string | boolean | ((metas: IViewField[], chats: IChatMessage[]) => PromiseLike<IVisSpec | IChart> | IVisSpec | IChart);
        };
    };
    children?: React.ReactNode | Iterable<React.ReactNode>;
}) {
    const vizStore = useVizStore();
    const { t } = useTranslation();

    const { segmentKey, vizEmbededMenu } = vizStore;

    const darkMode = useContext(themeContext);

    return (
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
                    {enhanceAPI?.features?.vlChat && (
                        <TabsTrigger value={ISegmentKey.chat}>
                            <ChatBubbleLeftRightIcon className="w-4 mr-2" /> {t('App.segments.chat')}
                        </TabsTrigger>
                    )}
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
                    <div style={{ marginTop: '0em' }} className={cn('m-4 p-4 border border-border rounded-md rounded-tl-none')}>
                        {enhanceAPI?.features?.askviz && (
                            <AskViz
                                api={typeof enhanceAPI.features.askviz === 'boolean' ? '' : enhanceAPI.features.askviz}
                                feedbackApi={typeof enhanceAPI.features.feedbackAskviz === 'boolean' ? '' : enhanceAPI.features.feedbackAskviz}
                                headers={enhanceAPI?.header}
                            />
                        )}
                        <VisualSettings darkModePreference={darkMode} />
                        <CodeExport />
                        <ExplainData />
                        {vizStore.showDataBoard && <DataBoard />}
                        <VisualConfig />
                        <LogPanel />
                        <BinPanel />
                        <RenamePanel />
                        <ComputedFieldDialog />
                        <Painter />
                        {vizStore.showGeoJSONConfigPanel && <GeoConfigPanel geoList={[]} />}
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
                                className="min-w-[100%] max-w-full sm:min-w-[164px] sm:max-w-[314px] flex-shrink-0"
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
                                    className="my-0.5 sm:ml-0.5 p-1 border relative h-[600px]"
                                    onMouseLeave={() => {
                                        vizEmbededMenu.show && vizStore.closeEmbededMenu();
                                    }}
                                    onClick={() => {
                                        vizEmbededMenu.show && vizStore.closeEmbededMenu();
                                    }}
                                >
                                    {children}
                                    <VizEmbedMenu />
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                {enhanceAPI?.features?.vlChat && (
                    <TabsContent value={ISegmentKey.chat}>
                        <VegaliteChat api={typeof enhanceAPI.features.vlChat === 'boolean' ? '' : enhanceAPI.features.vlChat} headers={enhanceAPI?.header} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
});

export function ReactVegaRenderer() {
    const computation = useContext(ComputationContext);
    const { vizThemeConfig } = useContext(vegaThemeContext);
    return <ReactiveRenderer vizThemeConfig={vizThemeConfig ?? 'vega'} computationFunction={computation} />;
}

export const RemoteRenderer = observer(function RemoteRenderer(props: { onChartChange?: (chart: IChart, setImage: (image: string) => void) => void }) {
    const [image, setImage] = useState<string | null>(null);
    const vizStore = useVizStore();
    useEffect(() => {
        return autorun(() => {
            props.onChartChange?.(vizStore.currentVis, setImage);
        });
    }, [props.onChartChange]);
    return (
        <div>
            <img src={image ?? undefined} />
        </div>
    );
});

export function GraphicWalkerContext({ children, ...props }: IGraphicWalkerContextProps) {
    // @TODO remove deprecated props
    const appearance = props.appearance;
    const data = props.data;
    const fields = props.fields ?? [];
    const {
        computation: safeComputation,
        safeMetas,
        onMetaChange: safeOnMetaChange,
    } = useMemo(() => {
        if (data) {
            return {
                safeMetas: fields,
                computation: getComputation(data),
                onMetaChange: props.onMetaChange,
            };
        }
        return {
            safeMetas: fields,
            computation: props.computation!,
            onMetaChange: props.onMetaChange,
        };
    }, [fields, data ? data : props.computation, props.onMetaChange]);

    const darkMode = useCurrentMediaTheme(appearance);

    return (
        <VizStoreWrapper
            onMetaChange={safeOnMetaChange}
            meta={safeMetas}
            keepAlive={props.keepAlive}
            storeRef={props.storeRef}
            defaultConfig={props.defaultConfig}
        >
            <VizApp
                computation={safeComputation}
                darkMode={darkMode}
                i18nLang={props.i18nLang}
                i18nResources={props.i18nResources}
                vizThemeConfig={props.vizThemeConfig}
            >
                {children}
            </VizApp>
        </VizStoreWrapper>
    );
}
