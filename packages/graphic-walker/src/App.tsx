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
    IGWPresenceDisplay,
    DraggableFieldState,
    IViewField,
    IFilterField,
    AgentEvent,
    AgentEncodingChannel,
    AgentMethodRequest,
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
import {
    buildEncodingFieldTargetId,
    buildFilterFieldTargetId,
    buildToolbarActionTargetId,
    parseAgentTargetId,
    type ToolbarActionKey,
} from './agent/targets';
import { validateAgentMethod } from './utils/agentMethodValidation';

type CloneFieldArgs = PropsMap[(typeof Methods)['cloneField']];
type MoveFieldArgs = PropsMap[(typeof Methods)['moveField']];
type AppendFilterArgs = PropsMap[(typeof Methods)['appendFilter']];
type RemoveFieldArgs = PropsMap[(typeof Methods)['removeField']];
type SetFieldAggregatorArgs = PropsMap[(typeof Methods)['setFieldAggregator']];
type ApplySortArgs = PropsMap[(typeof Methods)['applySort']];
type SetConfigArgs = PropsMap[(typeof Methods)['setConfig']];
type SetCoordSystemArgs = PropsMap[(typeof Methods)['setCoordSystem']];

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
    const instanceId = vizStore.instanceID;
    const currentVisId = vizStore.currentVis.visId;
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

    const [portal, setPortal] = useState<HTMLDivElement | null>(null);
    const previousEncodingsRef = useRef<DraggableFieldState>(vizStore.currentVis.encodings);

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

    const getRootInstanceRect = useCallback(() => {
        const rootEl = root.root;
        if (!rootEl) return null;
        const container = rootEl.querySelector('[data-gw-instance]');
        return container?.getBoundingClientRect() ?? null;
    }, [root]);

    const queryAgentTargetElement = useCallback(
        (targetId: string): HTMLElement | null => {
            const rootEl = root.root;
            if (!rootEl || !targetId) return null;
            const selectorId = targetId.replace(/"/g, '\"');
            return rootEl.querySelector<HTMLElement>(`[data-gw-target="${selectorId}"]`);
        },
        [root]
    );

    const queryVisTabElement = useCallback(
        (visId?: string): HTMLElement | null => {
            if (!visId) return null;
            const rootEl = root.root;
            if (!rootEl) return null;
            const selectorId = visId.replace(/"/g, '\"');
            return rootEl.querySelector<HTMLElement>(`[data-gw-visual-tab="${selectorId}"]`);
        },
        [root]
    );

    const spawnRectRipple = useCallback(
        (rect: DOMRect | null, options?: { borderRadius?: number; accentColor?: string; fillColor?: string }) => {
            if (!portal || !rect) return;
            const rootRect = getRootInstanceRect();
            if (!rootRect) return;
            const accent = options?.accentColor ?? 'hsl(var(--primary))';
            const fill = options?.fillColor ?? 'hsla(var(--primary), 0.1)';
            const radius = options?.borderRadius ?? Math.min(rect.width, rect.height) / 2;
            const ripple = document.createElement('div');
            ripple.className = 'gw-ripple pointer-events-none';
            ripple.style.position = 'absolute';
            ripple.style.left = `${rect.left - rootRect.left}px`;
            ripple.style.top = `${rect.top - rootRect.top}px`;
            ripple.style.width = `${rect.width}px`;
            ripple.style.height = `${rect.height}px`;
            ripple.style.borderRadius = `${radius}px`;
            ripple.style.border = `2px solid ${accent}`;
            ripple.style.background = fill;
            ripple.style.zIndex = '65';
            ripple.style.pointerEvents = 'none';
            ripple.style.transformOrigin = 'center';
            portal.appendChild(ripple);
            animate(ripple, {
                keyframes: [
                    { scale: 0.85, opacity: 0.55, duration: 1 },
                    { scale: 1.08, opacity: 0.3, duration: 320, easing: 'easeOutQuad' },
                    { scale: 1.12, opacity: 0, duration: 210, easing: 'easeInQuad' },
                ],
                onComplete: () => {
                    ripple.remove();
                },
            });
        },
        [portal, getRootInstanceRect]
    );

    const getFieldLabel = useCallback((channel: keyof DraggableFieldState, index: number) => {
        const prevEnc = previousEncodingsRef.current;
        const fields = prevEnc?.[channel] as IViewField[] | IFilterField[] | undefined;
        const field = fields?.[index];
        return field?.name || field?.fid || 'Field';
    }, []);

    const triggerToolbarRipple = useCallback(
        (actionKey: ToolbarActionKey) => {
            if (!actionKey) return;
            const targetId = buildToolbarActionTargetId(instanceId, currentVisId, actionKey);
            requestAnimationFrame(() => {
                const element = queryAgentTargetElement(targetId);
                if (!element) return;
                spawnRectRipple(element.getBoundingClientRect(), { borderRadius: 8 });
            });
        },
        [instanceId, currentVisId, queryAgentTargetElement, spawnRectRipple]
    );

    const triggerFieldRipple = useCallback(
        (channel: keyof DraggableFieldState, index: number) => {
            const prevEnc = previousEncodingsRef.current;
            const fields = prevEnc?.[channel] as IViewField[] | IFilterField[] | undefined;
            const field = fields?.[index] as IViewField | IFilterField | undefined;
            requestAnimationFrame(() => {
                let targetId: string | null = null;
                if (channel === 'filters') {
                    targetId = buildFilterFieldTargetId(instanceId, currentVisId, index, field?.fid);
                } else {
                    targetId = buildEncodingFieldTargetId(instanceId, currentVisId, channel as AgentEncodingChannel, index, field?.fid);
                }
                if (!targetId) return;
                const element = queryAgentTargetElement(targetId);
                if (!element) return;
                const rect = element.getBoundingClientRect();
                const radius = channel === 'filters' ? 10 : Math.max(rect.height / 2, 10);
                spawnRectRipple(rect, { borderRadius: radius });
            });
        },
        [instanceId, currentVisId, queryAgentTargetElement, spawnRectRipple]
    );

    const triggerTabRipple = useCallback(
        (visId: string) => {
            if (!visId) return;
            requestAnimationFrame(() => {
                const element = queryVisTabElement(visId);
                if (!element) return;
                spawnRectRipple(element.getBoundingClientRect(), { borderRadius: 12 });
            });
        },
        [queryVisTabElement, spawnRectRipple]
    );

    const dispatchAgentMethod = useCallback(
        async (request: AgentMethodRequest): Promise<AgentMethodResult> => {
            const validationError = validateAgentMethod(request);
            if (validationError) {
                return { success: false, error: validationError };
            }
            return vizStore.applyMethodFromAgent(request.method, request.args, request.targetVisId);
        },
        [vizStore, validateAgentMethod]
    );

    useEffect(() => {
        previousEncodingsRef.current = vizStore.currentVis.encodings;
    });

    const normalizePresenceEntry = useCallback((entry: IGWPresenceDisplay): IGWPresenceDisplay => {
        if (entry.visId) {
            return entry;
        }
        const parsed = parseAgentTargetId(entry.targetId);
        if (parsed?.visId) {
            return {
                ...entry,
                visId: parsed.visId,
            };
        }
        return entry;
    }, []);

    const handlePresenceUpdate = useCallback(
        (payload: IGWPresenceDisplay | IGWPresenceDisplay[]) => {
            const updates = (Array.isArray(payload) ? payload : [payload]).map(normalizePresenceEntry);
            setPresenceEntries((prev) => {
                const map = new Map(prev.map((entry) => [entry.userId, entry]));
                updates.forEach((entry) => map.set(entry.userId, entry));
                return Array.from(map.values());
            });
        },
        [normalizePresenceEntry]
    );

    const handlePresenceClear = useCallback((userId?: string) => {
        if (!userId) {
            setPresenceEntries([]);
            return;
        }
        setPresenceEntries((prev) => prev.filter((entry) => entry.userId !== userId));
    }, []);

    const handleAgentMethodEvent = useCallback(
        (event: AgentEvent) => {
            if (event.type !== 'method' || event.status !== 'success' || event.source !== 'api') {
                return;
            }
            if (event.visId && event.visId !== currentVisId) {
                triggerTabRipple(event.visId);
                return;
            }
            switch (event.method) {
                case 'moveField': {
                    const [fromChannel, fromIndex, toChannel] = event.args as MoveFieldArgs;
                    if (fromChannel && toChannel && fromChannel !== toChannel) {
                        animateChannelTransfer(String(fromChannel), String(toChannel), getFieldLabel(fromChannel as keyof DraggableFieldState, fromIndex));
                    }
                    break;
                }
                case 'cloneField': {
                    const [fromChannel, fromIndex, toChannel] = event.args as CloneFieldArgs;
                    if (fromChannel && toChannel && fromChannel !== toChannel) {
                        animateChannelTransfer(String(fromChannel), String(toChannel), getFieldLabel(fromChannel as keyof DraggableFieldState, fromIndex));
                    }
                    break;
                }
                case 'appendFilter': {
                    const [, sourceChannel, sourceIndex] = event.args as AppendFilterArgs;
                    if (sourceChannel) {
                        animateChannelTransfer(String(sourceChannel), 'filters', getFieldLabel(sourceChannel as keyof DraggableFieldState, sourceIndex));
                    }
                    break;
                }
                case 'transpose': {
                    triggerToolbarRipple('transpose');
                    break;
                }
                case 'applySort': {
                    const [direction] = event.args as ApplySortArgs;
                    if (direction === 'ascending') {
                        triggerToolbarRipple('sort:asc');
                    } else if (direction === 'descending') {
                        triggerToolbarRipple('sort:dec');
                    }
                    break;
                }
                case 'setConfig': {
                    const [configKey] = event.args as SetConfigArgs;
                    if (configKey === 'geoms') {
                        triggerToolbarRipple('mark_type');
                    }
                    break;
                }
                case 'setCoordSystem': {
                    const [_mode] = event.args as SetCoordSystemArgs;
                    triggerToolbarRipple('coord_system');
                    break;
                }
                case 'setFieldAggregator': {
                    const [channel, index] = event.args as SetFieldAggregatorArgs;
                    triggerFieldRipple(channel, index);
                    break;
                }
                case 'removeField': {
                    const [channel, index] = event.args as RemoveFieldArgs;
                    triggerFieldRipple(channel, index);
                    break;
                }
                default:
                    break;
            }
        },
        [animateChannelTransfer, currentVisId, getFieldLabel, triggerTabRipple, triggerToolbarRipple, triggerFieldRipple]
    );

    useEffect(() => {
        const handler = appRef.current;
        if (!handler) return;
        const defaultGetState = handler.getAgentState;
        const defaultDispatch = handler.dispatchMethod;
        const defaultUpdatePresence = handler.updatePresence;
        const defaultClearPresence = handler.clearPresence;
        const defaultApplyVizEvent = handler.applyVizEvent;
        handler.getAgentState = getAgentState;
        handler.dispatchMethod = dispatchAgentMethod;
        handler.updatePresence = handlePresenceUpdate;
        handler.clearPresence = handlePresenceClear;
        handler.applyVizEvent = (event) => {
            vizStore.applyVizEventFromAgent(event);
        };
        vizStore.setAgentEventEmitter((event) => handler.emitAgentEvent(event));
        return () => {
            if (appRef.current === handler) {
                handler.getAgentState = defaultGetState;
                handler.dispatchMethod = defaultDispatch;
                handler.updatePresence = defaultUpdatePresence;
                handler.clearPresence = defaultClearPresence;
                handler.applyVizEvent = defaultApplyVizEvent;
            }
            vizStore.setAgentEventEmitter(undefined);
        };
    }, [appRef, dispatchAgentMethod, getAgentState, handlePresenceClear, handlePresenceUpdate, vizStore]);

    useEffect(() => {
        const handler = appRef.current;
        if (!handler?.onAgentEvent) {
            return;
        }
        const dispose = handler.onAgentEvent(handleAgentMethodEvent);
        return () => {
            dispose?.();
        };
    }, [appRef, handleAgentMethodEvent]);

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

    const queryTargetElement = useCallback(
        (targetId: string): HTMLElement | null => {
            const rootEl = root.root;
            if (!rootEl || !targetId) return null;
            const selectorId = targetId.replace(/"/g, '\"');
            return rootEl.querySelector<HTMLElement>(`[data-gw-target="${selectorId}"]`);
        },
        [root]
    );

    const queryVisTabElement = useCallback(
        (visId?: string): HTMLElement | null => {
            if (!visId) return null;
            const rootEl = root.root;
            if (!rootEl) return null;
            const selectorId = visId.replace(/"/g, '\"');
            return rootEl.querySelector<HTMLElement>(`[data-gw-visual-tab="${selectorId}"]`);
        },
        [root]
    );

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
            const targetEl = queryTargetElement(entry.targetId) ?? queryVisTabElement(entry.visId ?? parseAgentTargetId(entry.targetId)?.visId);
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
    }, [entries, queryTargetElement, queryVisTabElement]);

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
