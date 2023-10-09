import {
    ArrowUturnLeftIcon,
    BarsArrowDownIcon,
    BarsArrowUpIcon,
    PhotoIcon,
    ArrowPathIcon,
    ArrowsPointingOutIcon,
    CubeIcon,
    Square3Stack3DIcon,
    StopIcon,
    ArrowUturnRightIcon,
    LockClosedIcon,
    LockOpenIcon,
    WrenchIcon,
    ChevronUpDownIcon,
    XMarkIcon,
    ChevronDoubleUpIcon,
    ArrowsUpDownIcon,
    LightBulbIcon,
    CodeBracketSquareIcon,
    Cog6ToothIcon,
    TableCellsIcon,
    MapPinIcon,
    GlobeAltIcon,
    RectangleGroupIcon,
    GlobeAmericasIcon,
    HashtagIcon,
} from '@heroicons/react/24/outline';
import { observer } from 'mobx-react-lite';
import React, { SVGProps, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { ResizeDialog } from '../components/sizeSetting';
import { GLOBAL_CONFIG } from '../config';
import { useVizStore } from '../store';
import { IStackMode, IDarkMode } from '../interfaces';
import { IReactVegaHandler } from '../vis/react-vega';
import Toolbar, { ToolbarItemProps } from '../components/toolbar';
import { ButtonWithShortcut } from './menubar';
import { useCurrentMediaTheme } from '../utils/media';
import throttle from '../utils/throttle';
import KanariesLogo from '../assets/kanaries.png';
import { ImageWithFallback } from '../components/timeoutImg';
import LimitSetting from '../components/limitSetting';

const Invisible = styled.div`
    clip: rect(1px, 1px, 1px, 1px);
    clip-path: inset(50%);
    height: 1px;
    width: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
`;

const FormContainer = styled.div`
    margin: 2px;
    border-radius: 1.2px;
    padding: 0.5em;
    display: flex;
    flex-direction: column;
    color: #444;
    .dark {
        color: #aaa;
    }
`;

interface IVisualSettings {
    darkModePreference: IDarkMode;
    rendererHandler?: React.RefObject<IReactVegaHandler>;
    csvHandler?: React.MutableRefObject<{ download: () => void }>;
    exclude?: string[];
    extra?: ToolbarItemProps[];
}

const VisualSettings: React.FC<IVisualSettings> = ({ rendererHandler, darkModePreference, csvHandler, extra = [], exclude = [] }) => {
    const vizStore = useVizStore();
    const { config, layout, canUndo, canRedo, limit } = vizStore;
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
            rendererHandler?.current?.getCanvasData().then(x => navigator.clipboard.writeText(x.join(',')));
        }, 200),
        [rendererHandler]
    );


    const downloadCSV = useCallback(
        throttle(() => {
            csvHandler?.current?.download();
        }, 200),
        []
    );

    const dark = useCurrentMediaTheme(darkModePreference) === 'dark';

    const items = useMemo<ToolbarItemProps[]>(() => {
        const builtInItems = [
            {
                key: 'undo',
                label: 'undo (Ctrl + Z)',
                icon: () => (
                    <>
                        <ArrowUturnLeftIcon />
                        <Invisible aria-hidden>
                            <ButtonWithShortcut label="undo" disabled={!canUndo} handler={vizStore.undo.bind(vizStore)} shortcut="Ctrl+Z" />
                        </Invisible>
                    </>
                ),
                onClick: () => vizStore.undo(),
                disabled: !canUndo,
            },
            {
                key: 'redo',
                label: 'redo (Ctrl+Shift+Z)',
                icon: () => (
                    <>
                        <ArrowUturnRightIcon />
                        <Invisible aria-hidden>
                            <ButtonWithShortcut label="redo" disabled={!canRedo} handler={vizStore.redo.bind(vizStore)} shortcut="Ctrl+Shift+Z" />
                        </Invisible>
                    </>
                ),
                onClick: () => vizStore.redo(),
                disabled: !canRedo,
            },
            '-',
            {
                key: 'aggregation',
                label: t('toggle.aggregation'),
                icon: CubeIcon,
                checked: defaultAggregated,
                onChange: (checked) => {
                    vizStore.setVisualConfig('defaultAggregated', checked);
                },
            },
            {
                key: 'mark_type',
                label: tGlobal('constant.mark_type.__enum__'),
                icon: StopIcon,
                styles: {
                    icon: {
                        color: 'rgb(294,115,22)',
                    },
                },
                options: GLOBAL_CONFIG.GEOM_TYPES[coordSystem].map((g) => ({
                    key: g,
                    label: tGlobal(`constant.mark_type.${g}`),
                    icon: {
                        auto: LightBulbIcon,
                        bar: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9,4v16h6v-16Z" />
                            </svg>
                        ),
                        line: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5,6L19,18" />
                            </svg>
                        ),
                        area: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="none"
                                fill="currentColor"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5,20v-17l14,4V20Z" />
                            </svg>
                        ),
                        trail: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="none"
                                fill="currentColor"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5,6l7,4l7-2v2l-7,4l-7,-4z" />
                            </svg>
                        ),
                        point: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9,12 A3,3,0,0,1,16,12 A3,3,0,0,1,9,12" />
                            </svg>
                        ),
                        circle: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="none"
                                fill="currentColor"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6,12 A6,6,0,0,1,18,12 A6,6,0,0,1,6,12" />
                            </svg>
                        ),
                        tick: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5,12h14" />
                            </svg>
                        ),
                        rect: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="none"
                                fill="currentColor"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5,5v14h14v-14z" />
                            </svg>
                        ),
                        text: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="currentColor"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
                                />
                            </svg>
                        ),
                        arc: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="none"
                                fill="currentColor"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12,21l-9,-15a12,12,0,0,1,18,0Z" />
                            </svg>
                        ),
                        boxplot: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7,7v9h10v-9Zm0,4h8M12,7v-6m-3,0h6M12,16v7m-3,0h6" />
                            </svg>
                        ),
                        table: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
                                />
                            </svg>
                        ),
                        poi: MapPinIcon,
                        choropleth: RectangleGroupIcon,
                    }[g],
                })),
                value: markType,
                onSelect: (value) => {
                    vizStore.setVisualConfig('geoms', [value]);
                },
            },
            {
                key: 'stack_mode',
                label: tGlobal('constant.stack_mode.__enum__'),
                icon: Square3Stack3DIcon,
                options: GLOBAL_CONFIG.STACK_MODE.map((g) => ({
                    key: g,
                    label: tGlobal(`constant.stack_mode.${g}`),
                    icon: {
                        none: XMarkIcon,
                        stack: ChevronDoubleUpIcon,
                        normalize: ArrowsUpDownIcon,
                        center: ChevronUpDownIcon, // TODO: fix unsafe extends
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
                icon: ArrowPathIcon,
                onClick: () => vizStore.transpose(),
            },
            {
                key: 'sort:asc',
                label: t('button.ascending'),
                icon: BarsArrowUpIcon,
                onClick: () => vizStore.applyDefaultSort('ascending'),
            },
            {
                key: 'sort:dec',
                label: t('button.descending'),
                icon: BarsArrowDownIcon,
                onClick: () => vizStore.applyDefaultSort('descending'),
            },
            {
                key: 'table:summary',
                label: t('table.summary'),
                icon: TableCellsIcon,
                checked: showTableSummary,
                onChange: checked => {
                    vizStore.setVisualLayout('showTableSummary', checked);
                },
            },
            '-',
            {
                key: 'axes_resize',
                label: t('toggle.axes_resize'),
                icon: ChevronUpDownIcon,
                checked: interactiveScale,
                onChange: (checked) => {
                    vizStore.setVisualLayout('interactiveScale', checked);
                },
            },
            {
                key: 'scale',
                icon: ArrowsPointingOutIcon,
                label: tGlobal(`constant.layout_type.__enum__`),
                options: GLOBAL_CONFIG.CHART_LAYOUT_TYPE.map((g) => ({
                    key: g,
                    label: tGlobal(`constant.layout_type.${g}`),
                    icon: g === 'auto' ? LockClosedIcon : LockOpenIcon,
                })),
                value: sizeMode,
                onSelect: (key) => {
                    vizStore.setVisualLayout('size', { ...layout.size, mode: key as 'fixed' | 'auto' });
                },
                form: (
                    <FormContainer>
                        <ResizeDialog
                            width={width}
                            height={height}
                            onHeightChange={(v) => {
                                vizStore.setVisualLayout('size', {
                                    mode: 'fixed',
                                    height: v,
                                    width: layout.size.width
                                });
                            }}
                            onWidthChange={(v) => {
                                vizStore.setVisualLayout('size', {
                                    mode: 'fixed',
                                    width: v,
                                    height: layout.size.height
                                });
                            }}
                        />
                    </FormContainer>
                ),
            },
            '-',
            {
                key: 'coord_system',
                label: tGlobal('constant.coord_system.__enum__'),
                icon: StopIcon,
                options: GLOBAL_CONFIG.COORD_TYPES.map(c => ({
                    key: c,
                    label: tGlobal(`constant.coord_system.${c}`),
                    icon: {
                        generic: (props: SVGProps<SVGSVGElement>) => <svg stroke="currentColor" fill="none" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2v20" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7h2M12 16h2M7 12v-2M16 12v-2"/></svg>,
                        geographic: GlobeAltIcon,
                    }[c],
                })),
                value: coordSystem,
                onSelect: value => {
                    const coord = value as typeof GLOBAL_CONFIG.COORD_TYPES[number];
                    vizStore.setCoordSystem(coord);
                },
            },
            coordSystem === 'geographic' && markType === 'choropleth' && {
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
                icon: WrenchIcon,
                checked: showActions,
                onChange: (checked) => {
                    vizStore.setVisualLayout('showActions', checked);
                },
            },
            ...coordSystem === 'generic' ?[{
                key: 'export_chart',
                label: t('button.export_chart'),
                icon: PhotoIcon,
                form: (
                    <FormContainer className={dark ? 'dark' : ''}>
                        <button
                            className={`text-xs pt-1 pb-1 pl-6 pr-6 ${
                                dark ? 'dark bg-zinc-900 text-gray-100 hover:bg-gray-700' : 'bg-white hover:bg-gray-200 text-gray-800'
                            }`}
                            aria-label={t('button.export_chart_as', { type: 'png' })}
                            onClick={() => downloadPNG()}
                        >
                            {t('button.export_chart_as', { type: 'png' })}
                        </button>
                        <button
                            className={`text-xs pt-1 pb-1 pl-6 pr-6 ${
                                dark ? 'dark bg-zinc-900 text-gray-100 hover:bg-gray-700' : 'bg-white hover:bg-gray-200 text-gray-800'
                            }`}
                            aria-label={t('button.export_chart_as', { type: 'svg' })}
                            onClick={() => downloadSVG()}
                        >
                            {t('button.export_chart_as', { type: 'svg' })}
                        </button>
                        <button
                            className={`text-xs pt-1 pb-1 pl-6 pr-6 ${
                                dark
                                    ? 'dark bg-zinc-900 text-gray-100 hover:bg-gray-700'
                                    : 'bg-white hover:bg-gray-200 text-gray-800'
                            }`}
                            aria-label={t('button.export_chart_as', { type: 'base64' })}
                            onClick={() => downloadBase64()}
                        >
                            {t('button.export_chart_as', { type: 'base64' })}
                        </button>
                    </FormContainer>
                ),
            }]:[],
            {
                key: 'csv',
                label: t('button.export_chart_as', { type: 'csv' }),
                icon: TableCellsIcon,
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
                icon: CodeBracketSquareIcon,
                onClick: () => {
                    vizStore.setShowCodeExportPanel(true);
                },
            },
            ...(extra.length === 0 ? [] : ['-', ...extra]),
            '-',
            {
                key: 'limit_axis',
                label: t('limit'),
                icon: HashtagIcon,
                form: (
                    <FormContainer>
                        <LimitSetting
                            value={limit}
                            setValue={(v) => {
                                vizStore.setVisualConfig('limit', v);
                            }}
                        />
                    </FormContainer>
                ),
            },
            '-',
            {
                key: 'kanaries',
                label: 'kanaries',
                icon: () => (
                    // Kanaries brand info is not allowed to be removed or changed unless you are granted with special permission.
                    <a href="https://docs.kanaries.net" target="_blank">
                        <ImageWithFallback
                            id="kanaries-logo"
                            className="p-1.5 opacity-70 hover:opacity-100"
                            src="https://imagedelivery.net/tSvh1MGEu9IgUanmf58srQ/b6bc899f-a129-4c3a-d08f-d406166d0c00/public"
                            fallbackSrc={KanariesLogo}
                            timeout={1000}
                            alt="kanaries"
                        />
                    </a>
                ),
            },
        ].filter(Boolean) as ToolbarItemProps[];

        const items = builtInItems.filter((item) => typeof item === 'string' || !exclude.includes(item.key));

        switch (vizStore.config.geoms[0]) {
            case 'table':
                return items;
            default:
                return items.filter(item => typeof item === 'string' || item.key !== 'table:summary');
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
        dark,
        extra,
        exclude,
        limit,
        showTableSummary,
    ]);

    return (
        <div style={{ margin: '0.38em 0.28em 0.2em 0.18em' }}>
            <Toolbar
                darkModePreference={darkModePreference}
                items={items}
                styles={{
                    root: {
                        '--background-color': '#fff',
                        '--dark-background-color': '#000',
                        '--color': '#777',
                        '--color-hover': '#555',
                        '--dark-color': '#999',
                        '--dark-color-hover': '#bbb',
                        '--blue': 'rgb(79,70,229)',
                        '--blue-dark': 'rgb(9, 6, 65)',
                    },
                    container: {
                        // border: '1px solid #e5e7eb',
                        // boxSizing: 'content-box',
                        // borderRadius: '1px',
                    },
                }}
            />
        </div>
    );
};

export default observer(VisualSettings);
