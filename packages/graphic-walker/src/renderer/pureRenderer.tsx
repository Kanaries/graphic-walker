import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Item } from 'vega';
import { ShadowDom } from '../shadow-dom';
import LeafletRenderer, { LEAFLET_DEFAULT_HEIGHT } from '../components/leafletRenderer';
import { withAppRoot } from '../components/appRoot';
import type {
    IDarkMode,
    IViewField,
    IRow,
    IThemeKey,
    DraggableFieldState,
    IVisualConfig,
    IVisualConfigNew,
    IComputationFunction,
    IVisualLayout,
    IChannelScales,
    IUIThemeConfig,
    IMutField,
} from '../interfaces';
import type { IReactVegaHandler } from '../vis/react-vega';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';
import { getComputation } from '../computation/clientComputation';
import { getSort } from '../utils';
import { GWGlobalConfig } from '../vis/theme';
import { GLOBAL_CONFIG } from '../config';
import { VizAppContext } from '../store/context';
import { useVizStore, VizStoreWrapper } from '../store';
import { useCurrentMediaTheme } from '../utils/media';
import LoadingLayer from '@/components/loadingLayer';
import { viewEncodingKeys } from '@/models/visSpec';
import { getTimeFormat } from '@/lib/inferMeta';
import { unexceptedUTCParsedPatternFormats } from '@/lib/op/offset';
import { VizEmbedMenu } from '@/components/embedMenu';
import DataBoard from '@/components/dataBoard';
import ExplainData from '@/components/explainData';

type IPureRendererProps = {
    className?: string;
    name?: string;
    /** @deprecated use vizThemeConfig instead */
    themeKey?: IThemeKey;
    /** @deprecated use vizThemeConfig instead */
    themeConfig?: GWGlobalConfig;
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    /** @deprecated renamed to appearance */
    dark?: IDarkMode;
    appearance?: IDarkMode;
    visualState: DraggableFieldState;
    visualConfig: IVisualConfigNew | IVisualConfig;
    visualLayout?: IVisualLayout;
    /** @deprecated renamed to uiTheme */
    colorConfig?: IUIThemeConfig;
    uiTheme?: IUIThemeConfig;
    locale?: string;
    /** @deprecated renamed to scales */
    channelScales?: IChannelScales;
    scales?: IChannelScales;
    overrideSize?: IVisualLayout['size'];
    disableCollapse?: boolean;
    enableVizEmbedMenu?: boolean;
};

type LocalProps = {
    type?: 'local';
    rawData: IRow[];
};

type RemoteProps = {
    type: 'remote';
    computation: IComputationFunction;
};

export type IRemotePureRendererProps = IPureRendererProps & RemoteProps & React.RefAttributes<IReactVegaHandler>;
export type ILocalPureRendererProps = IPureRendererProps & LocalProps & React.RefAttributes<IReactVegaHandler>;

/**
 * Render a readonly chart with given visualization schema.
 * This is a pure component, which means it will not depend on any global state.
 */
const PureRenderer = observer(
    forwardRef<IReactVegaHandler, IPureRendererProps & (LocalProps | RemoteProps)>(function PureRenderer(props, ref) {
    const {
        name,
        className,
        themeKey,
        uiTheme,
        colorConfig,
        vizThemeConfig,
        appearance,
        dark,
        visualState,
        visualConfig,
        visualLayout: layout,
        overrideSize,
        locale,
        type,
        themeConfig,
        channelScales,
        scales,
        disableCollapse,
        enableVizEmbedMenu = false,
    } = props;
    const vizStore = useVizStore();
    const computation = useMemo(() => {
        if (props.type === 'remote') {
            return props.computation;
        }
        return getComputation(props.rawData);
    }, [type, type === 'remote' ? props.computation : props.rawData]);

    const rawLayout = layout ?? (visualConfig as IVisualConfig);

    const visualLayout = useMemo(
        () => ({
            ...rawLayout,
            ...(overrideSize ? { size: overrideSize } : {}),
        }),
        [rawLayout, overrideSize]
    );

    const sizeMode = visualLayout.size.mode;

    const sort = getSort(visualState);
    const limit = visualConfig.limit ?? -1;
    const defaultAggregated = visualConfig?.defaultAggregated ?? false;

    const [viewData, setViewData] = useState<IRow[]>([]);
    const { allFields, viewDimensions, viewMeasures, filters } = useMemo(() => {
        const viewDimensions: IViewField[] = [];
        const viewMeasures: IViewField[] = [];

        const { dimensions, measures, filters, ...state } = visualState;
        const allFields = [...dimensions, ...measures];

        const dKeys = Object.keys(state) as (keyof DraggableFieldState)[];
        for (const dKey of dKeys) {
            for (const f of state[dKey]) {
                if (f.analyticType === 'dimension') {
                    viewDimensions.push(f);
                } else if (f.analyticType === 'measure') {
                    viewMeasures.push(f);
                }
            }
        }

        return { allFields, viewDimensions, viewMeasures, filters };
    }, [visualState]);

    const { viewData: data, loading: waiting } = useRenderer({
        allFields,
        viewDimensions,
        viewMeasures,
        filters,
        defaultAggregated,
        sort,
        folds: visualConfig.folds,
        limit,
        computationFunction: computation,
        timezoneDisplayOffset: visualConfig['timezoneDisplayOffset'],
    });
    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({ data });
    latestFromRef.current = { data };

    useEffect(() => {
        if (waiting === false) {
            unstable_batchedUpdates(() => {
                setViewData(latestFromRef.current.data);
            });
        }
    }, [waiting]);

    const { coordSystem = 'generic' } = visualConfig;
    const isSpatial = coordSystem === 'geographic';
    const darkMode = useCurrentMediaTheme(appearance ?? dark);
    const [currentTheme, setCurrentTheme] = useState<IThemeKey | GWGlobalConfig>(
        (vizThemeConfig ?? themeConfig ?? themeKey) as IThemeKey | GWGlobalConfig
    );
    const appliedThemeKey = typeof currentTheme === 'string' ? currentTheme : themeKey ?? 'vega';
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    const handleGeomClick = React.useCallback(
        (values: any, e: MouseEvent & { item: Item }) => {
            e.stopPropagation();
            if (!enableVizEmbedMenu || !vizStore || GLOBAL_CONFIG.EMBEDED_MENU_LIST.length === 0) {
                return;
            }

            runInAction(() => {
                vizStore.showEmbededMenu([e.clientX, e.clientY]);
                vizStore.setFilters(values);
            });

            const { vlPoint, ...datums } = values;
            const selectedMarkObject = Object.fromEntries(Object.entries(datums).map(([k, vs]) => [k, vs instanceof Array ? vs[0] : undefined]));
            const encodingFields = viewEncodingKeys(visualConfig.geoms[0]).flatMap((k) => visualState[k] as IViewField[]);
            const selectedTemporalFields = Object.keys(selectedMarkObject)
                .map((k) => encodingFields.find((x) => x.fid === k))
                .filter((x): x is IViewField => !!x && x.semanticType === 'temporal');

            if (selectedTemporalFields.length > 0) {
                const displayOffset = (visualConfig as IVisualConfigNew).timezoneDisplayOffset ?? new Date().getTimezoneOffset();
                selectedTemporalFields.forEach((f) => {
                    const offset = f.offset ?? new Date().getTimezoneOffset();
                    const set = new Set(viewData.map((x) => x[f.fid] as string | number));
                    selectedMarkObject[f.fid] = Array.from(set).find((x) => {
                        const format = getTimeFormat(x);
                        let offsetTime = displayOffset * -60000;
                        if (format !== 'timestamp') {
                            offsetTime += offset * 60000;
                            if (!unexceptedUTCParsedPatternFormats.includes(format)) {
                                offsetTime -= new Date().getTimezoneOffset() * 60000;
                            }
                        }
                        const time = new Date(x).getTime() + offsetTime;
                        return time === selectedMarkObject[f.fid];
                    });
                });
            }

            if (e.item.mark.marktype === 'line') {
                const keys = new Set(Object.keys(e.item.mark.group.datum ?? {}));
                vizStore.updateSelectedMarkObject(Object.fromEntries(Object.entries<string | number>(selectedMarkObject).filter(([k]) => keys.has(k))));
            } else {
                vizStore.updateSelectedMarkObject(selectedMarkObject);
            }
        },
        [enableVizEmbedMenu, vizStore, viewData, visualConfig, visualState]
    );

    return (
        <ShadowDom style={sizeMode === 'full' ? { width: '100%', height: '100%' } : undefined} className={className} uiTheme={uiTheme ?? colorConfig}>
            <VizAppContext
                ComputationContext={computation}
                themeContext={darkMode}
                vegaThemeContext={{ vizThemeConfig: currentTheme, setVizThemeConfig: setCurrentTheme }}
                portalContainerContext={portal}
            >
                {waiting && <LoadingLayer />}
                {enableVizEmbedMenu && <ExplainData themeKey={appliedThemeKey} />}
                {enableVizEmbedMenu && vizStore?.showDataBoard && <DataBoard />}
                <div
                    className={`App relative ${darkMode === 'dark' ? 'dark' : ''}`}
                    style={sizeMode === 'full' ? { width: '100%', height: '100%' } : undefined}
                    onMouseLeave={() => {
                        enableVizEmbedMenu && vizStore?.vizEmbededMenu.show && vizStore.closeEmbededMenu();
                    }}
                    onClick={() => {
                        enableVizEmbedMenu && vizStore?.vizEmbededMenu.show && vizStore.closeEmbededMenu();
                    }}
                >
                    {isSpatial && (
                        <div className="max-w-full" style={{ height: LEAFLET_DEFAULT_HEIGHT, flexGrow: 1 }}>
                            <LeafletRenderer data={data} draggableFieldState={visualState} visualConfig={visualConfig} visualLayout={visualLayout} />
                        </div>
                    )}
                    {isSpatial || (
                        <SpecRenderer
                            name={name}
                            data={viewData}
                            ref={ref}
                            draggableFieldState={visualState}
                            visualConfig={visualConfig}
                            layout={visualLayout}
                            locale={locale ?? 'en-US'}
                            scales={scales ?? channelScales}
                            vizThemeConfig={currentTheme}
                            disableCollapse={disableCollapse}
                            onGeomClick={enableVizEmbedMenu ? handleGeomClick : undefined}
                        />
                    )}
                    {enableVizEmbedMenu && <VizEmbedMenu />}
                    <div ref={setPortal} />
                </div>
            </VizAppContext>
        </ShadowDom>
    );
})
);

function getPureRendererMetas(visualState: DraggableFieldState): IMutField[] {
    const fieldMap = new Map<string, IMutField>();
    for (const field of [...visualState.dimensions, ...visualState.measures]) {
        if (!fieldMap.has(field.fid)) {
            fieldMap.set(field.fid, {
                fid: field.fid,
                name: field.name,
                basename: field.basename,
                semanticType: field.semanticType,
                analyticType: field.analyticType,
                offset: field.offset,
            });
        }
    }
    return Array.from(fieldMap.values());
}

const PureRendererStoreSync = observer(function PureRendererStoreSync({ children, props }: { children: React.ReactNode; props: IPureRendererProps }) {
    const vizStore = useVizStore();
    const chart = useMemo(
        () => ({
            visId: 'pure-renderer',
            name: props.name ?? 'Chart',
            encodings: props.visualState,
            config: props.visualConfig,
            layout: props.visualLayout ?? (props.visualConfig as IVisualConfig),
        }),
        [props.name, props.visualState, props.visualConfig, props.visualLayout]
    );

    useEffect(() => {
        vizStore.importCode([chart as any]);
    }, [vizStore, chart]);

    return <>{children}</>;
});

const PureRendererWithOptionalStore = forwardRef<IReactVegaHandler, IPureRendererProps & (LocalProps | RemoteProps)>(function PureRendererWithOptionalStore(props, ref) {
    if (!props.enableVizEmbedMenu) {
        return <PureRenderer {...props} ref={ref} />;
    }

    return (
        <VizStoreWrapper meta={getPureRendererMetas(props.visualState)}>
            <PureRendererStoreSync props={props}>
                <PureRenderer {...props} ref={ref} />
            </PureRendererStoreSync>
        </VizStoreWrapper>
    );
});

export default observer(withAppRoot<IPureRendererProps>(PureRendererWithOptionalStore)) as {
    (p: ILocalPureRendererProps): JSX.Element;
    (p: IRemotePureRendererProps): JSX.Element;
};
