import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { ShadowDom } from '../shadow-dom';
import LeafletRenderer, { LEAFLET_DEFAULT_HEIGHT, LEAFLET_DEFAULT_WIDTH } from '../components/leafletRenderer';
import { withAppRoot } from '../components/appRoot';
import type { IDarkMode, IViewField, IRow, IThemeKey, DraggableFieldState, IVisualConfigNew, IComputationFunction, IVisualLayout } from '../interfaces';
import type { IReactVegaHandler } from '../vis/react-vega';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';
import { getComputation } from '../computation/clientComputation';

type IPureRendererProps =
    | {
          name?: string;
          themeKey?: IThemeKey;
          dark?: IDarkMode;
          visualState: DraggableFieldState;
          visualConfig: IVisualConfigNew;
          visualLayout: IVisualLayout;
          sort?: 'none' | 'ascending' | 'descending';
          limit?: number;
          locale?: string;
      } & (
          | {
                type: 'remote';
                computation: IComputationFunction;
            }
          | {
                type?: 'local';
                rawData: IRow[];
            }
      );

/**
 * Render a readonly chart with given visualization schema.
 * This is a pure component, which means it will not depend on any global state.
 */
const PureRenderer = forwardRef<IReactVegaHandler, IPureRendererProps>(function PureRenderer(props, ref) {
    const { name, themeKey, dark, visualState, visualConfig, visualLayout, locale, sort, limit } = props;
    const computation = useMemo(() => {
        if (props.type === 'remote') {
            return props.computation;
        }
        return getComputation(props.rawData);
    }, [props.type, props.type === 'remote' ? props.computation : props.rawData]);
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
        sort: sort ?? 'none',
        limit: limit ?? -1,
        computationFunction: computation,
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

    return (
        <ShadowDom>
            <div className="relative">
                {isSpatial && (
                    <div style={{ width: LEAFLET_DEFAULT_WIDTH, height: LEAFLET_DEFAULT_HEIGHT }}>
                        <LeafletRenderer data={data} draggableFieldState={visualState} visualConfig={visualConfig} visualLayout={visualLayout} />
                    </div>
                )}
                {isSpatial || (
                    <SpecRenderer
                        name={name}
                        loading={waiting}
                        data={viewData}
                        ref={ref}
                        themeKey={themeKey}
                        dark={dark}
                        draggableFieldState={visualState}
                        visualConfig={visualConfig}
                        layout={visualLayout}
                        locale={locale ?? 'en-US'}
                    />
                )}
            </div>
        </ShadowDom>
    );
});

export default observer(withAppRoot<IPureRendererProps>(PureRenderer));
