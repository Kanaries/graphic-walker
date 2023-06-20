import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { observer } from 'mobx-react-lite';
import type { IDarkMode, IMutField, IViewField, IFilterField, IRow, IThemeKey, DraggableFieldState, IVisualConfig } from '../interfaces';
import type { IReactVegaHandler } from '../vis/react-vega';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';


interface IPureRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    fields: IMutField[];
    rawData?: IRow[];
    draggableState?: Partial<DraggableFieldState>;
    visualConfig?: Pick<IVisualConfig, 'defaultAggregated'> & Partial<IVisualConfig>;
}

const PureRenderer = forwardRef<IReactVegaHandler, IPureRendererProps>(function PureRenderer (props, ref) {
    const {
        themeKey,
        dark,
        fields,
        draggableState,
        rawData,
        visualConfig,
    } = props;
    const defaultAggregated = visualConfig?.defaultAggregated ?? false;

    const [viewData, setViewData] = useState<IRow[]>([]);

    const allFields = useMemo(() => {
        return fields.map<Omit<IViewField, 'dragId'>>(field => ({
            ...field,
            name: field.name || field.fid,
        }));
    }, [fields]);
    
    const { viewDimensions, viewMeasures, filters } = useMemo(() => {
        const viewDimensions: IViewField[] = [];
        const viewMeasures: IViewField[] = [];
        const filters: IFilterField[] = [];

        return { viewDimensions, viewMeasures, filters };
    }, [draggableState]);

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
        <SpecRenderer
            loading={waiting}
            data={viewData}
            fields={allFields}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
        />
    );
});

export default observer(PureRenderer);
