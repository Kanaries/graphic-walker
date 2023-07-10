import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { ShadowDom } from '../shadow-dom';
import AppRoot from '../components/appRoot';
import type { IDarkMode, IViewField, IRow, IThemeKey, DraggableFieldState, IVisualConfig } from '../interfaces';
import type { IReactVegaHandler } from '../vis/react-vega';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';

interface IPureRendererProps {
    name?: string;
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    rawData?: IRow[];
    visualState: DraggableFieldState;
    visualConfig: IVisualConfig;
}

/**
 * Render a readonly chart with given visualization schema.
 * This is a pure component, which means it will not depend on any global state.
 */
const PureRenderer = forwardRef<IReactVegaHandler, IPureRendererProps>(function PureRenderer (props, ref) {
    const {
        name,
        themeKey,
        dark,
        rawData,
        visualState,
        visualConfig,
    } = props;
    
    const defaultAggregated = visualConfig?.defaultAggregated ?? false;

    const [viewData, setViewData] = useState<IRow[]>([]);

    const { allFields, viewDimensions, viewMeasures, filters } = useMemo(() => {
        const viewDimensions: IViewField[] = [];
        const viewMeasures: IViewField[] = [];

        const { dimensions, measures, filters, ...state } = toJS(visualState);
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
        data: rawData ?? [],
        allFields,
        viewDimensions,
        viewMeasures,
        filters,
        defaultAggregated,
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

    return (
        <AppRoot>
            <ShadowDom>
                <div className="relative">
                    <SpecRenderer
                        name={name}
                        loading={waiting}
                        data={viewData}
                        ref={ref}
                        themeKey={themeKey}
                        dark={dark}
                        draggableFieldState={visualState}
                        visualConfig={visualConfig}
                    />
                </div>
            </ShadowDom>
        </AppRoot>
    );
});

export default observer(PureRenderer);
