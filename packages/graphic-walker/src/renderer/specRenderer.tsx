import { runInAction } from 'mobx';
import { Resizable } from 're-resizable';
import React, { useCallback, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { IDarkMode, IRow, IThemeKey } from '../interfaces';
import LoadingLayer from '../components/loadingLayer';
import { IVegaConfigSchema } from '../vis/protocol/adapter';
import VegaRenderer from '../vis/vega-renderer';
import type { IVisField, IVisSchema } from '../vis/protocol/interface';
import PivotTable from '../components/pivotTable';

interface SpecRendererProps {
    spec: IVisSchema<IVegaConfigSchema>;
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    fields: readonly IVisField[];
    loading: boolean;
}
const SpecRenderer = forwardRef<IReactVegaHandler, SpecRendererProps>(function (
    { spec, themeKey, dark, data, loading, fields },
    ref
) {
    const { vizStore, commonStore } = useGlobalStore();
    const { interactiveScale, showActions, size } = spec.configs;

    const { i18n } = useTranslation();

    const isPivotTable = spec.markType === 'table';

    const hasFacet = Boolean(spec.encodings.row || spec.encodings.column);

    const handleGeomClick = useCallback(
        (values: any, e: any) => {
            e.stopPropagation();
            runInAction(() => {
                commonStore.showEmbededMenu([e.pageX, e.pageY]);
                commonStore.setFilters(values);
            });
        },
        []
    );
    const enableResize = size.mode === 'fixed' && !hasFacet;

    if (isPivotTable) {
        return (
            <PivotTable
                spec={spec}
                data={data}
                fields={fields}
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
                vizStore.setChartLayout({
                    mode: 'fixed',
                    width: size.width + d.width,
                    height: size.height + d.height,
                });
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
            <VegaRenderer
                spec={spec}
                data={data}
                fields={fields}
                ref={ref}
                onGeomClick={handleGeomClick}
                locale={i18n.language}
            />
        </Resizable>
    );
});

export default SpecRenderer;
