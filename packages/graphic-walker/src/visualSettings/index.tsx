import {
    ArrowUturnLeftIcon,
    BarsArrowDownIcon,
    BarsArrowUpIcon,
    PhotoIcon,
    CubeIcon,
    Square3Stack3DIcon,
    StopIcon,
    ArrowUturnRightIcon,
    WrenchIcon,
    ChevronUpDownIcon,
    XMarkIcon,
    ChevronDoubleUpIcon,
    ArrowsUpDownIcon,
    LightBulbIcon,
    Cog6ToothIcon,
    TableCellsIcon,
    MapPinIcon,
    GlobeAltIcon,
    RectangleGroupIcon,
    GlobeAmericasIcon,
    DocumentPlusIcon,
    PaintBrushIcon,
} from '@heroicons/react/24/outline';
import { observer } from 'mobx-react-lite';
import React, { SVGProps, useCallback, useMemo } from 'react';
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
    rendererHandler?: React.RefObject<IReactVegaHandler>;
    csvHandler?: React.MutableRefObject<{ download: () => void }>;
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
                icon: (props: SVGProps<SVGSVGElement>) => (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                        <path
                            d="M7.59664 2.93628C7.76085 3.06401 8.00012 2.94698 8.00012 2.73895V1.99998C9.98143 2 11.1848 2.3637 11.9105 3.08945C12.6363 3.81522 13 5.0186 13 6.99998C13 7.27613 13.2239 7.49998 13.5 7.49998C13.7761 7.49998 14 7.27613 14 6.99998C14 4.9438 13.6325 3.39719 12.6176 2.38234C11.6028 1.36752 10.0562 0.999999 8.00012 0.999984V0.261266C8.00012 0.0532293 7.76085 -0.0637944 7.59664 0.063928L6.00384 1.30277C5.87516 1.40286 5.87516 1.59735 6.00384 1.69744L7.59664 2.93628ZM9.5 5H2.5C2.22386 5 2 5.22386 2 5.5V12.5C2 12.7761 2.22386 13 2.5 13H9.5C9.77614 13 10 12.7761 10 12.5V5.5C10 5.22386 9.77614 5 9.5 5ZM2.5 4C1.67157 4 1 4.67157 1 5.5V12.5C1 13.3284 1.67157 14 2.5 14H9.5C10.3284 14 11 13.3284 11 12.5V5.5C11 4.67157 10.3284 4 9.5 4H2.5Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        ></path>
                    </svg>
                ),
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
                onChange: (checked) => {
                    vizStore.setVisualLayout('showTableSummary', checked);
                },
            },
            ...(experimentalFeatures?.computedField
                ? [{ key: 'field:add', label: 'Add Computed Field', icon: DocumentPlusIcon, onClick: () => vizStore.setComputedFieldFid('') }]
                : []),
            '-',
            {
                key: 'axes_resize',
                label: t('toggle.axes_resize'),
                icon: (props: SVGProps<SVGSVGElement>) => (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                        <path
                            d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159ZM4.25 6.5C4.25 6.22386 4.47386 6 4.75 6H6V4.75C6 4.47386 6.22386 4.25 6.5 4.25C6.77614 4.25 7 4.47386 7 4.75V6H8.25C8.52614 6 8.75 6.22386 8.75 6.5C8.75 6.77614 8.52614 7 8.25 7H7V8.25C7 8.52614 6.77614 8.75 6.5 8.75C6.22386 8.75 6 8.52614 6 8.25V7H4.75C4.47386 7 4.25 6.77614 4.25 6.5Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        ></path>
                    </svg>
                ),
                checked: interactiveScale,
                onChange: (checked) => {
                    vizStore.setVisualLayout('interactiveScale', checked);
                },
            },
            {
                key: 'scale',
                icon: (props: SVGProps<SVGSVGElement>) => (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                        <path
                            d="M3.00014 2.73895C3.00014 2.94698 2.76087 3.06401 2.59666 2.93628L1.00386 1.69744C0.875177 1.59735 0.875177 1.40286 1.00386 1.30277L2.59666 0.063928C2.76087 -0.0637944 3.00014 0.0532293 3.00014 0.261266V1.00012H9.00009V0.261296C9.00009 0.0532591 9.23936 -0.0637646 9.40358 0.0639578L10.9964 1.3028C11.1251 1.40289 11.1251 1.59738 10.9964 1.69747L9.40358 2.93631C9.23936 3.06404 9.00009 2.94701 9.00009 2.73898V2.00012H3.00014V2.73895ZM9.50002 4.99998H2.50002C2.22388 4.99998 2.00002 5.22384 2.00002 5.49998V12.5C2.00002 12.7761 2.22388 13 2.50002 13H9.50002C9.77616 13 10 12.7761 10 12.5V5.49998C10 5.22384 9.77616 4.99998 9.50002 4.99998ZM2.50002 3.99998C1.67159 3.99998 1.00002 4.67156 1.00002 5.49998V12.5C1.00002 13.3284 1.67159 14 2.50002 14H9.50002C10.3284 14 11 13.3284 11 12.5V5.49998C11 4.67156 10.3284 3.99998 9.50002 3.99998H2.50002ZM14.7389 6.00001H14V12H14.7389C14.9469 12 15.064 12.2393 14.9362 12.4035L13.6974 13.9963C13.5973 14.125 13.4028 14.125 13.3027 13.9963L12.0639 12.4035C11.9362 12.2393 12.0532 12 12.2612 12H13V6.00001H12.2612C12.0532 6.00001 11.9361 5.76074 12.0639 5.59653L13.3027 4.00373C13.4028 3.87505 13.5973 3.87505 13.6974 4.00374L14.9362 5.59653C15.0639 5.76074 14.9469 6.00001 14.7389 6.00001Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        ></path>
                    </svg>
                ),
                label: tGlobal(`constant.layout_type.__enum__`),
                options: [
                    {
                        key: 'fixed',
                        label: tGlobal(`constant.layout_type.fixed`),
                        icon: (props: SVGProps<SVGSVGElement>) => (
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                                <path
                                    d="M1.44995 0.949951C1.31734 0.949951 1.19016 1.00263 1.0964 1.0964C1.00263 1.19017 0.949951 1.31735 0.949951 1.44995L0.949966 3.44995C0.949969 3.7261 1.17383 3.94995 1.44997 3.94995C1.72611 3.94995 1.94997 3.72609 1.94997 3.44995L1.94995 1.94995H3.44997C3.72611 1.94995 3.94997 1.72609 3.94997 1.44995C3.94997 1.17381 3.72611 0.949951 3.44997 0.949951H1.44995ZM5.94995 0.949951C5.67381 0.949951 5.44995 1.17381 5.44995 1.44995C5.44995 1.72609 5.67381 1.94995 5.94995 1.94995H8.94995C9.22609 1.94995 9.44995 1.72609 9.44995 1.44995C9.44995 1.17381 9.22609 0.949951 8.94995 0.949951H5.94995ZM5.44995 13.45C5.44995 13.1738 5.67381 12.95 5.94995 12.95H8.94995C9.22609 12.95 9.44995 13.1738 9.44995 13.45C9.44995 13.7261 9.22609 13.95 8.94995 13.95H5.94995C5.67381 13.95 5.44995 13.7261 5.44995 13.45ZM1.94995 5.94995C1.94995 5.67381 1.72609 5.44995 1.44995 5.44995C1.17381 5.44995 0.949951 5.67381 0.949951 5.94995V8.94995C0.949951 9.22609 1.17381 9.44995 1.44995 9.44995C1.72609 9.44995 1.94995 9.22609 1.94995 8.94995V5.94995ZM13.45 5.44995C13.7261 5.44995 13.95 5.67381 13.95 5.94995V8.94995C13.95 9.22609 13.7261 9.44995 13.45 9.44995C13.1738 9.44995 12.95 9.22609 12.95 8.94995V5.94995C12.95 5.67381 13.1738 5.44995 13.45 5.44995ZM11.45 0.949951C11.1738 0.949951 10.95 1.17381 10.95 1.44995C10.95 1.72609 11.1738 1.94995 11.45 1.94995H12.9499V3.44995C12.9499 3.72609 13.1738 3.94995 13.4499 3.94995C13.7261 3.94995 13.9499 3.72609 13.9499 3.44995V1.44995C13.9499 1.17381 13.7252 0.949951 13.449 0.949951H11.45ZM1.44995 10.95C1.72609 10.95 1.94995 11.1738 1.94995 11.45V12.95H3.44997C3.72611 12.95 3.94997 13.1738 3.94997 13.45C3.94997 13.7261 3.72611 13.95 3.44997 13.95H1.44995C1.17381 13.95 0.949951 13.7261 0.949951 13.45V11.45C0.949951 11.1738 1.17381 10.95 1.44995 10.95ZM13.95 11.45C13.95 11.1738 13.7261 10.95 13.45 10.95C13.1738 10.9499 12.95 11.1738 12.95 11.4499L12.9491 12.95H11.45C11.1738 12.95 10.95 13.1738 10.95 13.45C10.95 13.7261 11.1738 13.95 11.45 13.95H13.4499C13.7261 13.95 13.9499 13.7261 13.9499 13.45L13.95 11.45Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                ></path>
                            </svg>
                        ),
                    },
                    {
                        key: 'auto',
                        label: tGlobal(`constant.layout_type.auto`),
                        icon: (props: SVGProps<SVGSVGElement>) => (
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                                <path
                                    d="M1.49988 2.00012C1.77602 2.00012 1.99988 1.77626 1.99988 1.50012C1.99988 1.22398 1.77602 1.00012 1.49988 1.00012C1.22374 1.00012 0.999878 1.22398 0.999878 1.50012C0.999878 1.77626 1.22374 2.00012 1.49988 2.00012ZM4.49988 2.00012C4.77602 2.00012 4.99988 1.77626 4.99988 1.50012C4.99988 1.22398 4.77602 1.00012 4.49988 1.00012C4.22374 1.00012 3.99988 1.22398 3.99988 1.50012C3.99988 1.77626 4.22374 2.00012 4.49988 2.00012ZM7.99988 1.50012C7.99988 1.77626 7.77602 2.00012 7.49988 2.00012C7.22374 2.00012 6.99988 1.77626 6.99988 1.50012C6.99988 1.22398 7.22374 1.00012 7.49988 1.00012C7.77602 1.00012 7.99988 1.22398 7.99988 1.50012ZM10.4999 2.00012C10.776 2.00012 10.9999 1.77626 10.9999 1.50012C10.9999 1.22398 10.776 1.00012 10.4999 1.00012C10.2237 1.00012 9.99988 1.22398 9.99988 1.50012C9.99988 1.77626 10.2237 2.00012 10.4999 2.00012ZM13.9999 1.50012C13.9999 1.77626 13.776 2.00012 13.4999 2.00012C13.2237 2.00012 12.9999 1.77626 12.9999 1.50012C12.9999 1.22398 13.2237 1.00012 13.4999 1.00012C13.776 1.00012 13.9999 1.22398 13.9999 1.50012ZM1.49988 14.0001C1.77602 14.0001 1.99988 13.7763 1.99988 13.5001C1.99988 13.224 1.77602 13.0001 1.49988 13.0001C1.22374 13.0001 0.999878 13.224 0.999878 13.5001C0.999878 13.7763 1.22374 14.0001 1.49988 14.0001ZM1.99988 10.5001C1.99988 10.7763 1.77602 11.0001 1.49988 11.0001C1.22374 11.0001 0.999878 10.7763 0.999878 10.5001C0.999878 10.224 1.22374 10.0001 1.49988 10.0001C1.77602 10.0001 1.99988 10.224 1.99988 10.5001ZM1.49988 8.00012C1.77602 8.00012 1.99988 7.77626 1.99988 7.50012C1.99988 7.22398 1.77602 7.00012 1.49988 7.00012C1.22374 7.00012 0.999878 7.22398 0.999878 7.50012C0.999878 7.77626 1.22374 8.00012 1.49988 8.00012ZM1.99988 4.50012C1.99988 4.77626 1.77602 5.00012 1.49988 5.00012C1.22374 5.00012 0.999878 4.77626 0.999878 4.50012C0.999878 4.22398 1.22374 4.00012 1.49988 4.00012C1.77602 4.00012 1.99988 4.22398 1.99988 4.50012ZM13.4999 11.0001C13.776 11.0001 13.9999 10.7763 13.9999 10.5001C13.9999 10.224 13.776 10.0001 13.4999 10.0001C13.2237 10.0001 12.9999 10.224 12.9999 10.5001C12.9999 10.7763 13.2237 11.0001 13.4999 11.0001ZM13.9999 7.50012C13.9999 7.77626 13.776 8.00012 13.4999 8.00012C13.2237 8.00012 12.9999 7.77626 12.9999 7.50012C12.9999 7.22398 13.2237 7.00012 13.4999 7.00012C13.776 7.00012 13.9999 7.22398 13.9999 7.50012ZM13.4999 5.00012C13.776 5.00012 13.9999 4.77626 13.9999 4.50012C13.9999 4.22398 13.776 4.00012 13.4999 4.00012C13.2237 4.00012 12.9999 4.22398 12.9999 4.50012C12.9999 4.77626 13.2237 5.00012 13.4999 5.00012ZM4.99988 13.5001C4.99988 13.7763 4.77602 14.0001 4.49988 14.0001C4.22374 14.0001 3.99988 13.7763 3.99988 13.5001C3.99988 13.224 4.22374 13.0001 4.49988 13.0001C4.77602 13.0001 4.99988 13.224 4.99988 13.5001ZM7.49988 14.0001C7.77602 14.0001 7.99988 13.7763 7.99988 13.5001C7.99988 13.224 7.77602 13.0001 7.49988 13.0001C7.22374 13.0001 6.99988 13.224 6.99988 13.5001C6.99988 13.7763 7.22374 14.0001 7.49988 14.0001ZM10.9999 13.5001C10.9999 13.7763 10.776 14.0001 10.4999 14.0001C10.2237 14.0001 9.99988 13.7763 9.99988 13.5001C9.99988 13.224 10.2237 13.0001 10.4999 13.0001C10.776 13.0001 10.9999 13.224 10.9999 13.5001ZM13.4999 14.0001C13.776 14.0001 13.9999 13.7763 13.9999 13.5001C13.9999 13.224 13.776 13.0001 13.4999 13.0001C13.2237 13.0001 12.9999 13.224 12.9999 13.5001C12.9999 13.7763 13.2237 14.0001 13.4999 14.0001ZM3.99988 5.00012C3.99988 4.44784 4.44759 4.00012 4.99988 4.00012H9.99988C10.5522 4.00012 10.9999 4.44784 10.9999 5.00012V10.0001C10.9999 10.5524 10.5522 11.0001 9.99988 11.0001H4.99988C4.44759 11.0001 3.99988 10.5524 3.99988 10.0001V5.00012ZM4.99988 5.00012H9.99988V10.0001H4.99988V5.00012Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                ></path>
                            </svg>
                        ),
                    },
                    {
                        key: 'full',
                        label: tGlobal(`constant.layout_type.full`),
                        icon: (props: SVGProps<SVGSVGElement>) => (
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                                <path
                                    d="M1.99998 0.999976C1.44769 0.999976 0.999976 1.44769 0.999976 1.99998V13C0.999976 13.5523 1.44769 14 1.99998 14H13C13.5523 14 14 13.5523 14 13V1.99998C14 1.44769 13.5523 0.999976 13 0.999976H1.99998ZM1.99998 1.99998L13 1.99998V13H1.99998V1.99998ZM4.49996 3.99996C4.22382 3.99996 3.99996 4.22382 3.99996 4.49996V10.5C3.99996 10.7761 4.22382 11 4.49996 11H10.5C10.7761 11 11 10.7761 11 10.5V4.49996C11 4.22382 10.7761 3.99996 10.5 3.99996H4.49996ZM4.99996 9.99996V4.99996H9.99996V9.99996H4.99996Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                ></path>
                            </svg>
                        ),
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
                icon: (props: SVGProps<SVGSVGElement>) => (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                        <path
                            d="M8.8914 2.1937C9.1158 2.35464 9.16725 2.66701 9.00631 2.89141L2.47388 12H13.5C13.7761 12 14 12.2239 14 12.5C14 12.7762 13.7761 13 13.5 13H1.5C1.31254 13 1.14082 12.8952 1.0552 12.7284C0.969578 12.5616 0.984438 12.361 1.09369 12.2086L8.19369 2.30862C8.35462 2.08422 8.667 2.03277 8.8914 2.1937ZM11.1 6.50001C11.1 6.22387 11.3238 6.00001 11.6 6.00001C11.8761 6.00001 12.1 6.22387 12.1 6.50001C12.1 6.77615 11.8761 7.00001 11.6 7.00001C11.3238 7.00001 11.1 6.77615 11.1 6.50001ZM10.4 4.00001C10.1239 4.00001 9.90003 4.22387 9.90003 4.50001C9.90003 4.77615 10.1239 5.00001 10.4 5.00001C10.6762 5.00001 10.9 4.77615 10.9 4.50001C10.9 4.22387 10.6762 4.00001 10.4 4.00001ZM12.1 8.50001C12.1 8.22387 12.3238 8.00001 12.6 8.00001C12.8761 8.00001 13.1 8.22387 13.1 8.50001C13.1 8.77615 12.8761 9.00001 12.6 9.00001C12.3238 9.00001 12.1 8.77615 12.1 8.50001ZM13.4 10C13.1239 10 12.9 10.2239 12.9 10.5C12.9 10.7761 13.1239 11 13.4 11C13.6762 11 13.9 10.7761 13.9 10.5C13.9 10.2239 13.6762 10 13.4 10Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        ></path>
                    </svg>
                ),
                options: GLOBAL_CONFIG.COORD_TYPES.map((c) => ({
                    key: c,
                    label: tGlobal(`constant.coord_system.${c}`),
                    icon: {
                        generic: (props: SVGProps<SVGSVGElement>) => (
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="1.5"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden
                                {...props}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2v20" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7h2M12 16h2M7 12v-2M16 12v-2" />
                            </svg>
                        ),
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
                icon: WrenchIcon,
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
                          icon: PhotoIcon,
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
                icon: (props: SVGProps<SVGSVGElement>) => (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                        <path
                            d="M9.96424 2.68571C10.0668 2.42931 9.94209 2.13833 9.6857 2.03577C9.4293 1.93322 9.13832 2.05792 9.03576 2.31432L5.03576 12.3143C4.9332 12.5707 5.05791 12.8617 5.3143 12.9642C5.5707 13.0668 5.86168 12.9421 5.96424 12.6857L9.96424 2.68571ZM3.85355 5.14646C4.04882 5.34172 4.04882 5.6583 3.85355 5.85356L2.20711 7.50001L3.85355 9.14646C4.04882 9.34172 4.04882 9.6583 3.85355 9.85356C3.65829 10.0488 3.34171 10.0488 3.14645 9.85356L1.14645 7.85356C0.951184 7.6583 0.951184 7.34172 1.14645 7.14646L3.14645 5.14646C3.34171 4.9512 3.65829 4.9512 3.85355 5.14646ZM11.1464 5.14646C11.3417 4.9512 11.6583 4.9512 11.8536 5.14646L13.8536 7.14646C14.0488 7.34172 14.0488 7.6583 13.8536 7.85356L11.8536 9.85356C11.6583 10.0488 11.3417 10.0488 11.1464 9.85356C10.9512 9.6583 10.9512 9.34172 11.1464 9.14646L12.7929 7.50001L11.1464 5.85356C10.9512 5.6583 10.9512 5.34172 11.1464 5.14646Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        ></path>
                    </svg>
                ),
                onClick: () => {
                    vizStore.setShowCodeExportPanel(true);
                },
            },
            ...(extra.length === 0 ? [] : ['-', ...extra]),
            '-',
            {
                key: 'limit_axis',
                label: t('limit'),
                icon: (props: SVGProps<SVGSVGElement>) => (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
                        <path
                            d="M9.94969 7.49989C9.94969 8.85288 8.85288 9.94969 7.49989 9.94969C6.14691 9.94969 5.0501 8.85288 5.0501 7.49989C5.0501 6.14691 6.14691 5.0501 7.49989 5.0501C8.85288 5.0501 9.94969 6.14691 9.94969 7.49989ZM10.8632 8C10.6213 9.64055 9.20764 10.8997 7.49989 10.8997C5.79214 10.8997 4.37847 9.64055 4.13662 8H0.5C0.223858 8 0 7.77614 0 7.5C0 7.22386 0.223858 7 0.5 7H4.13659C4.37835 5.35935 5.79206 4.1001 7.49989 4.1001C9.20772 4.1001 10.6214 5.35935 10.8632 7H14.5C14.7761 7 15 7.22386 15 7.5C15 7.77614 14.7761 8 14.5 8H10.8632Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        ></path>
                    </svg>
                ),
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
