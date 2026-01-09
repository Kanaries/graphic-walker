import React, { useEffect, useMemo, useRef, useCallback, useState, useLayoutEffect, useContext } from 'react';
import { animate } from 'animejs';
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
    IComputationProps,
    IThemeKey,
    AgentMethodRequest,
    IGWPresenceDisplay,
    AgentMethodError,
    AgentMethodResult,
} from './interfaces';
import { GWGlobalConfig } from './vis/theme';
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
import { VegaliteMapper } from './lib/vl2gw';
import { newChart, Methods, type PropsMap } from './models/visSpecHistory';
import ComputedFieldDialog from './components/computedField';
import { VizAppContext } from './store/context';
import { useAppRootContext } from './components/appRoot';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { ChartPieIcon, CircleStackIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { TabsContent } from '@radix-ui/react-tabs';
import { VegaliteChat } from './components/chat';
import { ShadowDomContext } from './shadow-dom';

const CLONE_FIELD_SOURCE_CHANNELS = ['dimensions', 'measures'] as const;
const CLONE_FIELD_DEST_CHANNELS = [
    'rows',
    'columns',
    'color',
    'opacity',
    'size',
    'shape',
    'theta',
    'radius',
    'longitude',
    'latitude',
    'geoId',
    'details',
    'text',
    'tooltip',
] as const;
const CLONE_FIELD_SOURCE_SET = new Set<string>(CLONE_FIELD_SOURCE_CHANNELS);
const CLONE_FIELD_DEST_SET = new Set<string>(CLONE_FIELD_DEST_CHANNELS);
type CloneFieldArgs = PropsMap[(typeof Methods)['cloneField']];
type MoveFieldArgs = PropsMap[(typeof Methods)['moveField']];
type ChannelTransfer = { from: string; to: string; sourceIndex: number };

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
        vizThemeConfig,
        toolbar,
        geographicData,
        computationTimeout = 60000,
        spec,
        chart,
        vlSpec,
        onError,
        hideSegmentNav,
        hideProfiling,
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
    const appRef = useAppRootContext();
    const [presenceEntries, setPresenceEntries] = useState<IGWPresenceDisplay[]>([]);
    const root = useContext(ShadowDomContext);

    const getAgentState = useCallback(() => {
        const snapshot = vizStore.getAgentStateSnapshot();
        const rootEl = root.root;
        if (!rootEl) {
            return snapshot;
        }
        const renderedIds = new Set(
            Array.from(rootEl.querySelectorAll<HTMLElement>('[data-gw-target]'))
                .map((el) => el.getAttribute('data-gw-target'))
                .filter((value): value is string => Boolean(value))
        );
        if (!renderedIds.size) {
            return snapshot;
        }
        const filteredTargets = snapshot.targets.filter((target) => renderedIds.has(target.id));
        if (filteredTargets.length === snapshot.targets.length) {
            return snapshot;
        }
        return {
            ...snapshot,
            targets: filteredTargets,
        };
    }, [vizStore]);

    const validateAgentMethod = useCallback((request: AgentMethodRequest): AgentMethodError | null => {
        if (request.method === 'cloneField') {
            const [sourceKey, , destinationKey] = request.args as CloneFieldArgs;
            const sourceValid = CLONE_FIELD_SOURCE_SET.has(sourceKey);
            const destinationValid = CLONE_FIELD_DEST_SET.has(destinationKey);
            if (!sourceValid || !destinationValid) {
                return {
                    code: 'ERR_EXECUTION_FAILED',
                    message: 'cloneField requires a dimension/measure source and an encoding destination.',
                    details: `source=${sourceKey};destination=${destinationKey}`,
                };
            }
        }
        return null;
    }, []);

    const extractTransferChannels = useCallback((request: AgentMethodRequest): ChannelTransfer | null => {
        if (request.method === 'moveField') {
            const [fromChannel, fromIndex, toChannel] = request.args as MoveFieldArgs;
            if (fromChannel && toChannel && fromChannel !== toChannel && typeof fromIndex === 'number') {
                return { from: String(fromChannel), to: String(toChannel), sourceIndex: fromIndex };
            }
        }
        if (request.method === 'cloneField') {
            const [fromChannel, fromIndex, toChannel] = request.args as CloneFieldArgs;
            if (fromChannel && toChannel && fromChannel !== toChannel && typeof fromIndex === 'number') {
                return { from: String(fromChannel), to: String(toChannel), sourceIndex: fromIndex };
            }
        }
        return null;
    }, []);

    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    const animateChannelTransfer = useCallback(
        (fromChannel: string, toChannel: string, labelText: string) => {
            const rootEl = root.root;
            if (!rootEl || !fromChannel || !toChannel || fromChannel === toChannel) {
                return;
            }
            const run = () => {
                const sourceEl = rootEl.querySelector<HTMLElement>(`[data-gw-channel-container="${fromChannel}"]`);
                const targetEl = rootEl.querySelector<HTMLElement>(`[data-gw-channel-container="${toChannel}"]`);
                if (!sourceEl || !targetEl || !portal) {
                    return;
                }
                const rootRect = rootEl.querySelector('[data-gw-instance]')?.getBoundingClientRect();
                if (!rootRect) {
                    return;
                }
                const computeAnchor = (channelKey: string, rect: DOMRect) => {
                    const key = channelKey.toLowerCase();
                    if (key === 'rows' || key === 'columns') {
                        return {
                            x: rect.left + 120 - rootRect.left,
                            y: rect.top + rect.height / 2 - rootRect.top,
                        };
                    }
                    if (key === 'dimensions' || key === 'measures') {
                        return {
                            x: rect.left + rect.width / 2 - rootRect.left,
                            y: rect.top + rect.height / 2 - rootRect.top,
                        };
                    }
                    return {
                        x: rect.left + rect.width / 2 - rootRect.left,
                        y: rect.top + 50 - rootRect.top,
                    };
                };
                const sourceRect = sourceEl.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();
                const sourceAnchor = computeAnchor(fromChannel, sourceRect);
                const targetAnchor = computeAnchor(toChannel, targetRect);
                const indicator = document.createElement('div');
                indicator.className = 'gw-channel-transfer-indicator pointer-events-none';
                indicator.style.position = 'absolute';
                indicator.style.left = '0px';
                indicator.style.top = '0px';
                indicator.style.padding = '2px 10px';
                indicator.style.borderRadius = '9999px';
                indicator.style.color = 'hsl(var(--foreground))';
                indicator.style.background = 'hsl(var(--background))';
                indicator.style.borderWidth = '1px';
                indicator.style.borderColor = 'hsl(var(--border))';
                indicator.style.fontSize = '11px';
                indicator.style.fontWeight = '600';
                indicator.style.letterSpacing = '0.02em';
                indicator.style.display = 'inline-flex';
                indicator.style.alignItems = 'center';
                indicator.style.justifyContent = 'center';
                indicator.style.textTransform = 'uppercase';
                indicator.style.zIndex = '60';
                indicator.style.opacity = '0.95';
                indicator.textContent = labelText;
                portal.appendChild(indicator);
                const indicatorRect = indicator.getBoundingClientRect();
                const indicatorHalfWidth = indicatorRect.width / 2;
                const indicatorHalfHeight = indicatorRect.height / 2;
                const startX = sourceAnchor.x - indicatorHalfWidth;
                const startY = sourceAnchor.y - indicatorHalfHeight;
                const endX = targetAnchor.x - indicatorHalfWidth;
                const endY = targetAnchor.y - indicatorHalfHeight;
                animate(indicator, {
                    keyframes: [
                        {
                            translateX: startX,
                            translateY: startY,
                            scale: 0.9,
                            opacity: 0.95,
                            duration: 1,
                        },
                        {
                            translateX: endX,
                            translateY: endY,
                            scale: 1.08,
                            duration: 620,
                            easing: 'easeInOutCubic',
                        },
                        {
                            opacity: 0,
                            scale: 1,
                            duration: 200,
                            easing: 'easeInQuad',
                        },
                    ],
                    onComplete: () => {
                        indicator.remove();
                    },
                });
            };
            requestAnimationFrame(run);
        },
        [portal]
    );

    const dispatchAgentMethod = useCallback(
        async (request: AgentMethodRequest): Promise<AgentMethodResult> => {
            const validationError = validateAgentMethod(request);
            if (validationError) {
                return { success: false, error: validationError };
            }
            const transferChannels = extractTransferChannels(request);
            let transferLabel: string | undefined;
            if (transferChannels) {
                const encodings = vizStore.currentVis?.encodings ?? {};
                const field = encodings[transferChannels.from]?.[transferChannels.sourceIndex];
                transferLabel = field?.name || field?.fid;
            }
            const result = await vizStore.applyMethodFromAgent(request.method, request.args);
            if (result.success && transferChannels) {
                animateChannelTransfer(transferChannels.from, transferChannels.to, transferLabel || '');
            }
            return result;
        },
        [vizStore, validateAgentMethod, extractTransferChannels, animateChannelTransfer]
    );

    const handlePresenceUpdate = useCallback((payload: IGWPresenceDisplay | IGWPresenceDisplay[]) => {
        setPresenceEntries((prev) => {
            const map = new Map(prev.map((entry) => [entry.userId, entry]));
            (Array.isArray(payload) ? payload : [payload]).forEach((entry) => map.set(entry.userId, entry));
            return Array.from(map.values());
        });
    }, []);

    const handlePresenceClear = useCallback((userId?: string) => {
        if (!userId) {
            setPresenceEntries([]);
            return;
        }
        setPresenceEntries((prev) => prev.filter((entry) => entry.userId !== userId));
    }, []);

    useEffect(() => {
        const handler = appRef.current;
        if (!handler) return;
        const defaultGetState = handler.getAgentState;
        const defaultDispatch = handler.dispatchMethod;
        const defaultUpdatePresence = handler.updatePresence;
        const defaultClearPresence = handler.clearPresence;
        handler.getAgentState = getAgentState;
        handler.dispatchMethod = dispatchAgentMethod;
        handler.updatePresence = handlePresenceUpdate;
        handler.clearPresence = handlePresenceClear;
        vizStore.setAgentEventEmitter((event) => handler.emitAgentEvent(event));
        return () => {
            if (appRef.current === handler) {
                handler.getAgentState = defaultGetState;
                handler.dispatchMethod = defaultDispatch;
                handler.updatePresence = defaultUpdatePresence;
                handler.clearPresence = defaultClearPresence;
            }
            vizStore.setAgentEventEmitter(undefined);
        };
    }, [appRef, dispatchAgentMethod, getAgentState, handlePresenceClear, handlePresenceUpdate, vizStore]);

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
                    vlSpec,
                    [...emptyChart.encodings.dimensions, ...emptyChart.encodings.measures],
                    vizStore.currentVis.visId,
                    vizStore.currentVis.name ?? 'Chart 1'
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
    const [currentTheme, setCurrentTheme] = useState<IThemeKey | GWGlobalConfig>((vizThemeConfig ?? themeConfig ?? themeKey) as IThemeKey | GWGlobalConfig);
    const appliedThemeKey = typeof currentTheme === 'string' ? currentTheme : themeKey;
    const appliedThemeConfig = typeof currentTheme === 'object' ? currentTheme : themeConfig;

    const wrappedComputation = useMemo(
        () => (computation ? withErrorReport(withTimeout(computation, computationTimeout), (err) => reportError(parseErrorMessage(err), 501)) : async () => []),
        [reportError, computation, computationTimeout]
    );

    return (
        <ErrorContext value={{ reportError }}>
            <ErrorBoundary fallback={<div>Something went wrong</div>} onError={props.onError}>
                <VizAppContext
                    ComputationContext={wrappedComputation}
                    themeContext={darkMode}
                    vegaThemeContext={{ vizThemeConfig: currentTheme, setVizThemeConfig: setCurrentTheme }}
                    portalContainerContext={portal}
                >
                    <div
                        data-gw-instance={vizStore.instanceID}
                        className={classNames(`App relative font-sans bg-background text-foreground m-0 p-0 w-full h-full`, darkMode === 'dark' ? 'dark' : '')}
                    >
                        <FieldsContextWrapper>
                            <div className="bg-background text-foreground w-full h-full">
                                <Errorpanel />
                                <Tabs
                                    value={segmentKey}
                                    onValueChange={(v) => vizStore.setSegmentKey(v as ISegmentKey)}
                                    className="w-full h-full flex flex-col"
                                >
                                    {!hideSegmentNav && (
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
                                    )}
                                    <TabsContent value={ISegmentKey.data}>
                                        <div className="mx-4 -mt-px p-4 border rounded-md rounded-t-none">
                                            <DatasetConfig hideProfiling={hideProfiling} />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value={ISegmentKey.vis} className="flex-1 min-h-0 flex flex-col">
                                        {!props.hideChartNav && (
                                            <div className="px-2 mx-2 mt-2">
                                                <VisNav />
                                            </div>
                                        )}
                                        <div
                                            style={{ marginTop: '0em' }}
                                            className={cn(
                                                'm-4 p-4 border border-border rounded-md rounded-tl-none flex-1 min-h-0 flex flex-col',
                                                props.hideChartNav ? 'border-t-0 rounded-t-none' : ''
                                            )}
                                        >
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
                                            <ExplainData themeKey={appliedThemeKey} />
                                            {vizStore.showDataBoard && <DataBoard hideProfiling={hideProfiling} />}
                                            <VisualConfig />
                                            <LogPanel />
                                            <BinPanel />
                                            <RenamePanel />
                                            <ComputedFieldDialog />
                                            <Painter themeConfig={appliedThemeConfig} themeKey={appliedThemeKey} />
                                            {vizStore.showGeoJSONConfigPanel && <GeoConfigPanel geoList={props.geoList} />}
                                            <div className="sm:flex flex-1 min-h-0">
                                                <SideResize
                                                    defaultWidth={240}
                                                    handleWidth={4}
                                                    className="min-w-[100%] max-w-full sm:min-w-[96px] sm:max-w-[35%] flex-shrink-0 sm:min-h-full flex flex-col"
                                                    handlerClassName="hidden sm:block"
                                                >
                                                    <DatasetFields />
                                                </SideResize>
                                                <SideResize
                                                    defaultWidth={180}
                                                    handleWidth={4}
                                                    className="min-w-[100%] max-w-full sm:min-w-[164px] sm:max-w-[314px] flex-shrink-0 flex flex-col"
                                                    handlerClassName="hidden sm:block"
                                                >
                                                    <FilterField />
                                                    <AestheticFields />
                                                </SideResize>
                                                <div className="flex-1 min-w-[0px] flex flex-col">
                                                    <div>
                                                        <PosFields />
                                                    </div>
                                                    <div
                                                        className="my-0.5 sm:ml-0.5 p-1 border relative flex-1 min-h-0"
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
                                                                vizThemeConfig={currentTheme}
                                                                computationFunction={wrappedComputation}
                                                                // @TODO remove channelScales
                                                                scales={props.scales ?? props.channelScales}
                                                            />
                                                        )}
                                                        <VizEmbedMenu />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                    {enhanceAPI?.features?.vlChat && (
                                        <TabsContent value={ISegmentKey.chat}>
                                            <VegaliteChat
                                                api={typeof enhanceAPI.features.vlChat === 'boolean' ? '' : enhanceAPI.features.vlChat}
                                                headers={enhanceAPI?.header}
                                                // @TODO remove channelScales
                                                scales={props.scales ?? props.channelScales}
                                            />
                                        </TabsContent>
                                    )}
                                </Tabs>
                            </div>
                        </FieldsContextWrapper>
                        <PresenceOverlay entries={presenceEntries} />
                        <div ref={setPortal} />
                    </div>
                </VizAppContext>
            </ErrorBoundary>
        </ErrorContext>
    );
});

type PresenceRenderEntry = IGWPresenceDisplay & {
    rect: { top: number; left: number; width: number; height: number };
};

const PresenceOverlay: React.FC<{ entries: IGWPresenceDisplay[] }> = ({ entries }) => {
    const [renderEntries, setRenderEntries] = useState<PresenceRenderEntry[]>([]);
    const root = useContext(ShadowDomContext);

    const queryTargetElement = useCallback((targetId: string): HTMLElement | null => {
        const rootEl = root.root;
        if (!rootEl || !targetId) return null;
        const selectorId = targetId.replace(/"/g, '\\"');
        return rootEl.querySelector<HTMLElement>(`[data-gw-target="${selectorId}"]`);
    }, []);

    const updateRects = useCallback(() => {
        const rootEl = root.root;
        if (!rootEl) {
            setRenderEntries([]);
            return;
        }
        const rootRect = rootEl.querySelector('[data-gw-instance]')?.getBoundingClientRect();
        if (!rootRect) {
            setRenderEntries([]);
            return;
        }
        const next: PresenceRenderEntry[] = [];
        entries.forEach((entry) => {
            const targetEl = queryTargetElement(entry.targetId);
            if (!targetEl) return;
            const rects = targetEl.getClientRects();
            if (rects.length === 0) return;
            const rect = rects[0];
            next.push({
                ...entry,
                rect: {
                    top: rect.top - rootRect.top,
                    left: rect.left - rootRect.left,
                    width: rect.width,
                    height: rect.height,
                },
            });
        });
        setRenderEntries(next);
    }, [entries, queryTargetElement]);

    useLayoutEffect(() => {
        updateRects();
    }, [updateRects]);

    useEffect(() => {
        const handleResize = () => updateRects();
        const handleScroll = () => updateRects();
        window.addEventListener('resize', handleResize);
        document.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [updateRects]);

    if (renderEntries.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 z-50">
            {renderEntries.map((entry) => (
                <div
                    key={entry.userId}
                    className="absolute rounded-lg border-2"
                    style={{
                        top: Math.max(entry.rect.top - 4, 0),
                        left: Math.max(entry.rect.left - 4, 0),
                        width: entry.rect.width + 8,
                        height: entry.rect.height + 8,
                        borderColor: entry.color || '#2563eb',
                        boxShadow: `0 0 12px ${entry.color || '#2563eb'}66`,
                    }}
                >
                    <div
                        className="absolute -top-6 left-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                            background: entry.color || '#2563eb',
                            color: '#fff',
                        }}
                    >
                        <span className="truncate max-w-48">{entry.displayName || entry.userId}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export function VizAppWithContext(props: IVizAppProps & IComputationProps) {
    const { computation, onMetaChange, fieldKeyGuard, keepAlive, storeRef, defaultConfig, defaultRenderer, ...rest } = props;
    // @TODO remove deprecated props
    const appearance = props.appearance ?? props.dark;
    const data = props.data ?? props.dataSource;
    const fields = props.fields ?? props.rawFields ?? [];
    const {
        computation: safeComputation,
        safeMetas,
        onMetaChange: safeOnMetaChange,
    } = useMemo(() => {
        if (data) {
            if (props.fieldKeyGuard) {
                const { safeData, safeMetas } = guardDataKeys(data, fields);
                return {
                    safeMetas,
                    computation: getComputation(safeData),
                    onMetaChange: (safeFID, meta) => {
                        const index = safeMetas.findIndex((x) => x.fid === safeFID);
                        if (index >= 0) {
                            props.onMetaChange?.(fields[index].fid, meta);
                        }
                    },
                };
            }
            return {
                safeMetas: fields,
                computation: getComputation(data),
                onMetaChange: props.onMetaChange,
            };
        }
        return {
            safeMetas: fields,
            computation: props.computation,
            onMetaChange: props.onMetaChange,
        };
    }, [fields, data ? data : props.computation, props.fieldKeyGuard, props.onMetaChange]);

    const darkMode = useCurrentMediaTheme(appearance);

    return (
        <VizStoreWrapper
            onMetaChange={safeOnMetaChange}
            meta={safeMetas}
            keepAlive={keepAlive}
            storeRef={storeRef}
            defaultConfig={defaultConfig}
            defaultRenderer={defaultRenderer}
        >
            <VizApp darkMode={darkMode} computation={safeComputation} {...rest} />
        </VizStoreWrapper>
    );
}
