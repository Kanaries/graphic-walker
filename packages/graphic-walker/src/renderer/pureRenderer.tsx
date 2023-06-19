import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { nanoid } from 'nanoid';
import WebWorkerDataLoader from '../dataLoader/webWorkerDataLoader';
import type { IDarkMode, IMutField, IRow, IThemeKey } from '../interfaces';
import type { IReactVegaHandler } from '../vis/react-vega';
import type { IGWDataLoader } from '../dataLoader';
import type { IVisSchema } from '../vis/protocol/interface';
import SpecRenderer from './specRenderer';
import { useRenderer } from './hooks';


interface IPureRendererProps {
    spec: IVisSchema;
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    defaultDatasetId?: string;
    dataLoader?: IGWDataLoader;
    fields: IMutField[];
    rawData?: IRow[];
}

const PureRenderer = forwardRef<IReactVegaHandler, IPureRendererProps>(function PureRenderer (props, ref) {
    const {
        spec,
        dataLoader = new WebWorkerDataLoader(),
        themeKey,
        dark,
        defaultDatasetId = nanoid(),
        fields,
        rawData,
    } = props;

    const { current: datasetId } = useRef(defaultDatasetId);

    const [visSpec, setVisSpec] = useState<IVisSchema>({
        datasetId,
        markType: 'bar',
        encodings: {},
    });
    const [viewData, setViewData] = useState<IRow[]>([]);

    useEffect(() => {
        dataLoader.syncMeta({
            datasetId,
            dimensions: fields.filter(f => f.analyticType === 'dimension').map(f => ({
                key: f.fid,
                name: f.name,
                type: f.semanticType,
            })),
            measures: fields.filter(f => f.analyticType === 'measure').map(f => ({
                key: f.fid,
                name: f.name,
                type: f.semanticType,
            })),
        });
    }, [dataLoader, datasetId, fields]);

    useEffect(() => {
        dataLoader.syncData(rawData ?? []);
    }, [dataLoader, rawData]);

    const { viewData: data, parsed, loading: waiting } = useRenderer({
        spec,
        dataLoader,
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

    const [{ dimensions: dims, measures: meas }, metaLoading] = dataLoader.useMeta();
    const visFields = useMemo(() => [...dims, ...meas], [dims, meas]);

    return (
        <SpecRenderer
            spec={visSpec}
            loading={waiting || metaLoading}
            data={viewData}
            fields={visFields}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
        />
    );
});

export default observer(PureRenderer);
