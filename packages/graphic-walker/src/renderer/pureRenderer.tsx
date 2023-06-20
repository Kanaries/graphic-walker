import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { nanoid } from 'nanoid';
import type { IDarkMode, IMutField, IRow, IThemeKey, IViewField } from '../interfaces';
import type { IVisField, IVisSchema } from '../vis/protocol/interface';
import type { IReactVegaHandler } from '../vis/react-vega';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';


interface IPureRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    rawData?: IRow[];
    spec: IVisSchema;
    datasetId?: string;
    fields: IMutField[];
    locale?: string;
}

/**
 * Render a readonly chart with given visualization schema.
 * This is a pure component, which means it will not depend on any global state.
 */
const PureRenderer = forwardRef<IReactVegaHandler, IPureRendererProps>(function PureRenderer (props, ref) {
    const {
        themeKey,
        dark,
        rawData,
        fields,
        spec,
        datasetId,
        locale,
    } = props;

    const [visSpec, setVisSpec] = useState<IVisSchema>({
        datasetId: datasetId ?? nanoid(),
        markType: 'bar',
        encodings: {},
    });
    const [viewData, setViewData] = useState<IRow[]>([]);

    const columns = useMemo(() => {
        return fields.map<Omit<IViewField, 'dragId'>>(f => ({ ...f, name: f.name ?? f.fid }));
    }, [fields]);

    const { viewData: data, parsed, loading: waiting } = useRenderer({
        spec,
        data: rawData,
        fields: columns,
        datasetId,
    });

    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({ spec, data, parsed });
    latestFromRef.current = { spec, data, parsed };

    useEffect(() => {
        if (waiting === false) {
            unstable_batchedUpdates(() => {
                setVisSpec(latestFromRef.current.spec);
                setViewData(latestFromRef.current.data);
            });
        }
    }, [waiting]);

    const visFields = useMemo(() => {
        return columns.map<IVisField>(col => ({
            key: col.fid,
            type: col.semanticType,
            name: col.name,
            expression: col.expression,
        }));
    }, [columns]);

    return (
        <SpecRenderer
            loading={waiting}
            fields={visFields}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
            data={viewData}
            spec={visSpec}
            locale={locale ?? 'en-US'}
        />
    );
});

export default observer(PureRenderer);
