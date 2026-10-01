import {
    ArrowUturnLeftIcon,
    ArrowUturnRightIcon,
    Cog6ToothIcon,
    MapPinIcon,
    GlobeAltIcon,
    GlobeAmericasIcon,
    PaintBrushIcon,
    SparklesIcon,
    CodeBracketIcon,
} from '@heroicons/react/24/outline';
import {
    AggregationIcon,
    AxesZoomIcon,
    ComputedFieldIcon,
    CoordGenericIcon,
    CoordSystemIcon,
    DebugIcon,
    ExportChartIcon,
    ExportCsvIcon,
    LayoutAutoIcon,
    LayoutFixedIcon,
    LayoutFullIcon,
    LayoutSizeIcon,
    MarkArcIcon,
    MarkAreaIcon,
    MarkAutoIcon,
    MarkBarIcon,
    MarkBoxplotIcon,
    MarkChoroplethIcon,
    MarkCircleIcon,
    MarkLineIcon,
    MarkPointIcon,
    MarkRectIcon,
    MarkTableIcon,
    MarkTextIcon,
    MarkTickIcon,
    MarkTrailIcon,
    MarkTypeIcon,
    RowLimitIcon,
    SortAscendingIcon,
    SortDescendingIcon,
    StackCenterIcon,
    StackIcon,
    StackNoneIcon,
    StackNormalizeIcon,
    TableSummaryIcon,
    TransposeIcon,
} from '../components/icons/toolbar';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResizeDialog } from '../components/sizeSetting';
import { GLOBAL_CONFIG } from '../config';
import { useVizStore } from '../store';
import { IStackMode, IDarkMode, IExperimentalFeatures } from '../interfaces';
import { IReactVegaHandler } from '../vis/react-vega';
import Toolbar, { ToolbarItemProps } from '../components/toolbar';
import { useShortcut } from './menubar';
import throttle from '../utils/throttle';
import KanariesLogo from '../assets/kanaries.png';
import { ImageWithFallback } from '../components/timeoutImg';
import LimitSetting from '../components/limitSetting';
import { omitRedundantSeparator } from './utils';
import { Button } from '@/components/ui/button';
import { classNames } from '@/utils';

interface IVisualSettings {
    darkModePreference: IDarkMode;
    rendererHandler?: React.RefObject<IReactVegaHandler | null>;
    csvHandler?: React.RefObject<{ download: () => void }>;
    exclude?: string[];
    extra?: ToolbarItemProps[];
    experimentalFeatures?: IExperimentalFeatures;
}

const KanariesIcon = (props: { className?: string; style?: React.CSSProperties }) => (
    <ImageWithFallback
        id="kanaries-logo"
        className={classNames(props.className, 'opacity-70 hover:opacity-100')}
        style={props.style}
        src="https://imagedelivery.net/tSvh1MGEu9IgUanmf58srQ/b6bc899f-a129-4c3a-d08f-d406166d0c00/public"
        fallbackSrc={KanariesLogo}
        timeout={1000}
        alt="kanaries documents"
    />
);

const VisualSettings: React.FC<IVisualSettings> = ({ rendererHandler, csvHandler, extra = [], exclude = [], experimentalFeatures }) => {
    const vizStore = useVizStore();
    const { config, layout, canUndo, canRedo, limit, paintInfo } = vizStore;
    const { t: tGlobal } = useTranslation();
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    const {
        defaultAggregated,
        coordSystem = 'generic',
        geoms: [markType],
    } = config;

    const {
        showTableSummary,
        stack,
        interactiveScale,
        size: { mode: sizeMode, width, height },
        showActions,
    } = layout;

    const downloadPNG = useCallback(
        throttle(() => {
            rendererHandler?.current?.downloadPNG();
        }, 200),
        [rendererHandler]
    );

    const downloadSVG = useCallback(
        throttle(() => {
            rendererHandler?.current?.downloadSVG();
        }, 200),
        [rendererHandler]
    );

    const downloadBase64 = useCallback(
        throttle(() => {
            rendererHandler?.current?.getCanvasData().then((x) => navigator.clipboard.writeText(x.join(',')));
        }, 200),
        [rendererHandler]
    );

    const downloadCSV = useCallback(
        throttle(() => {
            csvHandler?.current?.download();
        }, 200),
        []
    );

    const items = useMemo<ToolbarItemProps[]>(() => {
        const builtInItems = [
            {
                key: 'undo',
                label: 'undo (Ctrl + Z)',
                icon: (props: Omit<React.SVGProps<SVGSVGElement>, 'ref'>) => {
                    useShortcut('Ctrl+Z', vizStore.undo.bind(vizStore));
                    return <ArrowUturnLeftIcon {...props} />;
                },
                onClick: () => vizStore.undo(),
                disabled: !canUndo,
            },
            {
                key: 'redo',
                label: 'redo (Ctrl+Shift+Z)',
                icon: (props: Omit<React.SVGProps<SVGSVGElement>, 'ref'>) => {
                    useShortcut('Ctrl+Shift+Z', vizStore.redo.bind(vizStore));
                    return <ArrowUturnRightIcon {...props} />;
                },
                onClick: () => vizStore.redo(),
                disabled: !canRedo,
            },
            '-',
            {
                key: 'aggregation',
                label: t('toggle.aggregation'),
                icon: AggregationIcon,
                checked: defaultAggregated,
                onChange: (checked) => {
                    vizStore.setVisualConfig('defaultAggregated', checked);
                },
            },
            {
                key: 'mark_type',
                label: tGlobal('constant.mark_type.__enum__'),
                icon: MarkTypeIcon,
                options: GLOBAL_CONFIG.GEOM_TYPES[coordSystem].map((g) => ({
                    key: g,
                    label: tGlobal(`constant.mark_type.${g}`),
                    icon: {
                        auto: MarkAutoIcon,
                        bar: MarkBarIcon,
                        line: MarkLineIcon,
                        area: MarkAreaIcon,
                        trail: MarkTrailIcon,
                        point: MarkPointIcon,
                        circle: MarkCircleIcon,
                        tick: MarkTickIcon,
                        rect: MarkRectIcon,
                        text: MarkTextIcon,
                        arc: MarkArcIcon,
                        boxplot: MarkBoxplotIcon,
                        table: MarkTableIcon,
                        poi: MapPinIcon,
                        choropleth: MarkChoroplethIcon,
                    }[g],
                })),
                value: markType,
                onSelect: (value) => {
                    vizStore.setVisualConfig('geoms', [value]);
                },
            },
            {
                key: 'autoviz',
                label: t('autoviz'),
                icon: SparklesIcon,
                checked: vizStore.showAutoVizPanel,
                onChange: (checked: boolean) => vizStore.setShowAutoVizPanel(checked),
            },
            {
                key: 'stack_mode',
                label: tGlobal('constant.stack_mode.__enum__'),
                icon: StackIcon,
                options: GLOBAL_CONFIG.STACK_MODE.map((g) => ({
                    key: g,
                    label: tGlobal(`constant.stack_mode.${g}`),
                    icon: {
                        none: StackNoneIcon,
                        stack: StackIcon,
                        normalize: StackNormalizeIcon,
                        center: StackCenterIcon, // TODO: fix unsafe extends
                    }[g],
                })),
                value: stack,
                onSelect: (value) => {
                    vizStore.setVisualLayout('stack', value as IStackMode);
                },
            },
            '-',
            {
                key: 'transpose',
                label: t('button.transpose'),
                icon: TransposeIcon,
                onClick: () => vizStore.transpose(),
            },
            {
                key: 'sort:asc',
                label: t('button.ascending'),
                icon: SortAscendingIcon,
                onClick: () => vizStore.applyDefaultSort('ascending'),
            },
            {
                key: 'sort:dec',
                label: t('button.descending'),
                icon: SortDescendingIcon,
                onClick: () => vizStore.applyDefaultSort('descending'),
            },
            {
                key: 'table:summary',
                label: t('table.summary'),
                icon: TableSummaryIcon,
                checked: showTableSummary,
                onChange: (checked) => {
                    vizStore.setVisualLayout('showTableSummary', checked);
                },
            },
            ...(experimentalFeatures?.computedField
                ? [{ key: 'field:add', label: 'Add Computed Field', icon: ComputedFieldIcon, onClick: () => vizStore.setComputedFieldFid('') }]
                : []),
            '-',
            {
                key: 'axes_resize',
                label: t('toggle.axes_resize'),
                icon: AxesZoomIcon,
                checked: interactiveScale,
                onChange: (checked) => {
                    vizStore.setVisualLayout('interactiveScale', checked);
                },
            },
            {
                key: 'scale',
                icon: LayoutSizeIcon,
                label: tGlobal(`constant.layout_type.__enum__`),
                options: [
                    {
                        key: 'fixed',
                        label: tGlobal(`constant.layout_type.fixed`),
                        icon: LayoutFixedIcon,
                    },
                    {
                        key: 'auto',
                        label: tGlobal(`constant.layout_type.auto`),
                        icon: LayoutAutoIcon,
                    },
                    {
                        key: 'full',
                        label: tGlobal(`constant.layout_type.full`),
                        icon: LayoutFullIcon,
                    },
                ],
                // GLOBAL_CONFIG.CHART_LAYOUT_TYPE.map((g) => ({
                //     key: g,
                //     label: tGlobal(`constant.layout_type.${g}`),
                //     icon: g === 'auto' ? LockClosedIcon : LockOpenIcon,
                // })),
                value: sizeMode,
                onSelect: (key) => {
                    vizStore.setVisualLayout('size', { ...layout.size, mode: key as 'fixed' | 'auto' });
                },
                form: (
                    <ResizeDialog
                        width={width}
                        height={height}
                        onHeightChange={(v) => {
                            vizStore.setVisualLayout('size', {
                                mode: 'fixed',
                                height: v,
                                width: layout.size.width,
                            });
                        }}
                        onWidthChange={(v) => {
                            vizStore.setVisualLayout('size', {
                                mode: 'fixed',
                                width: v,
                                height: layout.size.height,
                            });
                        }}
                    />
                ),
            },
            '-',
            {
                key: 'coord_system',
                label: tGlobal('constant.coord_system.__enum__'),
                icon: CoordSystemIcon,
                options: GLOBAL_CONFIG.COORD_TYPES.map((c) => ({
                    key: c,
                    label: tGlobal(`constant.coord_system.${c}`),
                    icon: {
                        generic: CoordGenericIcon,
                        geographic: GlobeAltIcon,
                    }[c],
                })),
                value: coordSystem,
                onSelect: (value) => {
                    const coord = value as (typeof GLOBAL_CONFIG.COORD_TYPES)[number];
                    vizStore.setCoordSystem(coord);
                },
            },
            coordSystem === 'geographic' &&
                markType === 'choropleth' && {
                    key: 'geojson',
                    label: t('button.geojson'),
                    icon: GlobeAmericasIcon,
                    onClick: () => {
                        vizStore.setShowGeoJSONConfigPanel(true);
                    },
                },
            '-',
            {
                key: 'debug',
                label: t('toggle.debug'),
                icon: DebugIcon,
                checked: showActions,
                onChange: (checked) => {
                    vizStore.setVisualLayout('showActions', checked);
                },
            },
            ...(coordSystem === 'generic'
                ? [
                      {
                          key: 'export_chart',
                          label: t('button.export_chart'),
                          icon: ExportChartIcon,
                          form: (
                              <div className="flex flex-col">
                                  <Button variant="ghost" aria-label={t('button.export_chart_as', { type: 'png' })} onClick={() => downloadPNG()}>
                                      {t('button.export_chart_as', { type: 'png' })}
                                  </Button>
                                  <Button variant="ghost" aria-label={t('button.export_chart_as', { type: 'svg' })} onClick={() => downloadSVG()}>
                                      {t('button.export_chart_as', { type: 'svg' })}
                                  </Button>
                                  <Button variant="ghost" aria-label={t('button.export_chart_as', { type: 'base64' })} onClick={() => downloadBase64()}>
                                      {t('button.export_chart_as', { type: 'base64' })}
                                  </Button>
                              </div>
                          ),
                      },
                  ]
                : []),
            {
                key: 'csv',
                label: t('button.export_chart_as', { type: 'csv' }),
                icon: ExportCsvIcon,
                onClick: downloadCSV,
            },
            {
                key: 'config',
                label: t('button.config'),
                icon: Cog6ToothIcon,
                onClick: () => {
                    vizStore.setShowVisualConfigPanel(true);
                },
            },
            {
                key: 'export_code',
                label: t('button.export_code'),
                icon: CodeBracketIcon,
                onClick: () => {
                    vizStore.setShowCodeExportPanel(true);
                },
            },
            ...(extra.length === 0 ? [] : ['-', ...extra]),
            '-',
            {
                key: 'limit_axis',
                label: t('limit'),
                icon: RowLimitIcon,
                form: (
                    <LimitSetting
                        value={limit}
                        setValue={(v) => {
                            vizStore.setVisualConfig('limit', v);
                        }}
                    />
                ),
            },
            {
                key: 'painter',
                label: paintInfo.type === 'error' ? t(`button.disabled_painter.${paintInfo.key}`) : t('button.painter'),
                icon: PaintBrushIcon,
                disabled: paintInfo.type === 'error',
                onClick: () => {
                    vizStore.setShowPainter(true);
                },
            },
            '-',
            {
                key: 'kanaries',
                label: 'kanaries docs',
                href: 'https://docs.kanaries.net',
                // Kanaries brand info is not allowed to be removed or changed unless you are granted with special permission.
                icon: KanariesIcon,
                styles: {
                    icon: {
                        height: 20,
                        width: 'auto',
                    },
                },
            },
        ].filter(Boolean) as ToolbarItemProps[];

        const items = omitRedundantSeparator(builtInItems.filter((item) => typeof item === 'string' || !exclude.includes(item.key)));

        switch (vizStore.config.geoms[0]) {
            case 'table':
                return items;
            default:
                return items.filter((item) => typeof item === 'string' || item.key !== 'table:summary');
        }
    }, [
        vizStore,
        canUndo,
        canRedo,
        defaultAggregated,
        markType,
        coordSystem,
        stack,
        interactiveScale,
        sizeMode,
        width,
        height,
        showActions,
        downloadPNG,
        downloadSVG,
        extra,
        exclude,
        limit,
        showTableSummary,
        experimentalFeatures,
        paintInfo,
    ]);

    return <Toolbar items={items} />;
};

export default observer(VisualSettings);
