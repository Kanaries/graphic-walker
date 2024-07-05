import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { observer } from 'mobx-react-lite';
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
} from '../interfaces';
import type { IReactVegaHandler } from '../vis/react-vega';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';
import { getComputation } from '../computation/clientComputation';
import { getSort } from '../utils';
import { GWGlobalConfig } from '../vis/theme';
import { VizAppContext } from '../store/context';
import { useCurrentMediaTheme } from '../utils/media';
import LoadingLayer from '@/components/loadingLayer';

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
const PureRenderer = forwardRef<IReactVegaHandler, IPureRendererProps & (LocalProps | RemoteProps)>(function PureRenderer(props, ref) {
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
    } = props;
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
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    return (
        <ShadowDom style={sizeMode === 'full' ? { width: '100%', height: '100%' } : undefined} className={className} uiTheme={uiTheme ?? colorConfig}>
            <VizAppContext
                ComputationContext={computation}
                themeContext={darkMode}
                vegaThemeContext={{ vizThemeConfig: vizThemeConfig ?? themeConfig ?? themeKey }}
                portalContainerContext={portal}
            >
                {waiting && <LoadingLayer />}
                <div className={`App relative ${darkMode === 'dark' ? 'dark' : ''}`} style={sizeMode === 'full' ? { width: '100%', height: '100%' } : undefined}>
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
                            vizThemeConfig={vizThemeConfig ?? themeConfig ?? themeKey}
                            disableCollapse={disableCollapse}
                        />
                    )}
                    <div ref={setPortal} />
                </div>
            </VizAppContext>
        </ShadowDom>
    );
});

export default observer(withAppRoot<IPureRendererProps>(PureRenderer)) as {
    (p: ILocalPureRendererProps): JSX.Element;
    (p: IRemotePureRendererProps): JSX.Element;
};
