import { Resizable } from 're-resizable';
import React, { forwardRef, useMemo } from 'react';

import PivotTable from '../components/pivotTable';
import ReactVega, { IReactVegaHandler } from '../vis/react-vega';
import { IDarkMode, IRow, IThemeKey } from '../interfaces';
import LoadingLayer from '../components/loadingLayer';
import { forwardVegaVisSchema } from '../vis/protocol/adapter';
import type { IVisField, IVisSchema } from '../vis/protocol/interface';

interface SpecRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    loading: boolean;
    spec: IVisSchema;
    fields: readonly IVisField[];
    onGeomClick?: ((values: any, e: any) => void) | undefined;
    onChartResize?: ((width: number, height: number) => void) | undefined;
    locale: string;
}
/**
 * Sans-store renderer of GraphicWalker.
 * This is a pure component, which means it will not depend on any global state.
 */
const SpecRenderer = forwardRef<IReactVegaHandler, SpecRendererProps>(function (
    { spec, themeKey, dark, data, loading, fields, onGeomClick, onChartResize, locale },
    ref
) {
    const vegaSpec = useMemo(() => forwardVegaVisSchema(spec), [spec]);
    const { size } = vegaSpec.configs;

    const isPivotTable = spec.markType === 'table';

    const hasFacet = Boolean(spec.encodings.row || spec.encodings.column);

    const enableResize = size.mode === 'fixed' && !hasFacet && Boolean(onChartResize);

    if (isPivotTable) {
        return (
            <PivotTable
                data={data}
                fields={fields}
                spec={spec}
                loading={loading}
                themeKey={themeKey}
                dark={dark}
            />
        );
    }

    return (
        <Resizable
            className={enableResize ? 'border-blue-400 border-2 overflow-hidden' : ''}
            style={{ padding: '12px' }}
            onResizeStop={(e, direction, ref, d) => {
                onChartResize?.(size.width + d.width, size.height + d.height);
            }}
            enable={
                enableResize
                    ? undefined
                    : {
                          top: false,
                          right: false,
                          bottom: false,
                          left: false,
                          topRight: false,
                          bottomRight: false,
                          bottomLeft: false,
                          topLeft: false,
                      }
            }
            size={{
                width: size.width + 'px',
                height: size.height + 'px',
            }}
        >
            {loading && <LoadingLayer />}
            <ReactVega
                spec={vegaSpec}
                data={data}
                fields={fields}
                ref={ref}
                onGeomClick={onGeomClick}
                locale={locale}
            />
        </Resizable>
    );
});

export default SpecRenderer;
