import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { nanoid } from 'nanoid';
import type { IDarkMode, IMutField, IRow, IThemeKey, IViewField } from '../interfaces';
import type { IVisField, IVisSchema } from '../vis/protocol/interface';
import type { IReactVegaHandler } from '../vis/react-vega';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';


export interface IPureRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    rawData?: IRow[];
    schema: IVisSchema;
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
        schema,
        datasetId,
        locale,
    } = props;

    const [visSpec, setVisSpec] = useState<IVisSchema>({
        datasetId: datasetId ?? nanoid(),
        markType: 'bar',
        encodings: {},
    });
    const [viewFields, setViewFields] = useState<IVisField[]>([]);
    const [viewData, setViewData] = useState<IRow[]>([]);

    const columns = useMemo(() => {
        return fields.map<Omit<IViewField, 'dragId'>>(f => ({ ...f, name: f.name ?? f.fid }));
    }, [fields]);

    const { viewData: data, parsed, loading: waiting } = useRenderer({
        spec: schema,
        data: rawData,
        fields: columns,
        datasetId,
    });

    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({ spec: schema, data, parsed });
    latestFromRef.current = { spec: schema, data, parsed };

    useEffect(() => {
        if (waiting === false) {
            unstable_batchedUpdates(() => {
                setVisSpec(latestFromRef.current.spec);
                setViewFields(latestFromRef.current.parsed.fields);
                setViewData(latestFromRef.current.data);
            });
        }
    }, [waiting]);

    return (
        <div className="relative">
            <SpecRenderer
                loading={waiting}
                fields={viewFields}
                ref={ref}
                themeKey={themeKey}
                dark={dark}
                data={viewData}
                schema={visSpec}
                locale={locale ?? 'en-US'}
            />
        </div>
    );
});

export default observer(PureRenderer);
