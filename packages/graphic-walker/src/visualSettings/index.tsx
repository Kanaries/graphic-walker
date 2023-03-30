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
    ViewfinderCircleIcon,
    ChatBubbleBottomCenterTextIcon,
    PaintBrushIcon,
    CursorArrowRaysIcon,
    WrenchIcon,
    ChevronUpDownIcon,
    XMarkIcon,
    ChevronDoubleUpIcon,
    ArrowsUpDownIcon,
    LightBulbIcon,
    CodeBracketSquareIcon,
} from '@heroicons/react/24/outline';
import { observer } from 'mobx-react-lite';
import React, { SVGProps, useCallback, useMemo } from 'react';
import styled from 'styled-components'
import { useTranslation } from 'react-i18next';
import { ResizeDialog } from '../components/sizeSetting';
import { GEMO_TYPES, STACK_MODE, CHART_LAYOUT_TYPE } from '../config';
import { useGlobalStore } from '../store';
import { IStackMode, EXPLORATION_TYPES, IBrushDirection, BRUSH_DIRECTIONS, IDarkMode } from '../interfaces';
import { IReactVegaHandler } from '../vis/react-vega';
import Toolbar, { ToolbarItemProps } from '../components/toolbar';
import { ButtonWithShortcut } from './menubar';
import { useCurrentMediaTheme } from '../utils/media';
import throttle from '../utils/throttle';


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
}

const VisualSettings: React.FC<IVisualSettings> = ({ rendererHandler, darkModePreference }) => {
    const { vizStore, commonStore } = useGlobalStore();
    const { visualConfig, canUndo, canRedo } = vizStore;
    const { t: tGlobal } = useTranslation();
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    const {
        defaultAggregated, geoms: [markType], stack, interactiveScale, size: { mode: sizeMode, width, height },
        exploration: { mode: explorationMode, brushDirection }, showActions,
    } = visualConfig;

    const downloadPNG = useCallback(throttle(() => {
        rendererHandler?.current?.downloadPNG();
    }, 200), [rendererHandler]);

    const downloadSVG = useCallback(throttle(() => {
        rendererHandler?.current?.downloadSVG();
    }, 200), [rendererHandler]);

    const dark = useCurrentMediaTheme(darkModePreference) === 'dark';

    const items = useMemo<ToolbarItemProps[]>(() => {
        return [
            {
                key: 'undo',
                label: 'undo (Ctrl + Z)',
                icon: () => (
                    <>
                        <ArrowUturnLeftIcon />
                        <Invisible aria-hidden>
                            <ButtonWithShortcut
                                label="undo"
                                disabled={!canUndo}
                                handler={vizStore.undo.bind(vizStore)}
                                shortcut="Ctrl+Z"
                            />
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
                            <ButtonWithShortcut
                                label="redo"
                                disabled={!canRedo}
                                handler={vizStore.redo.bind(vizStore)}
                                shortcut="Ctrl+Shift+Z"
                            />
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
                onChange: checked => {
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
                options: GEMO_TYPES.map(g => ({
                    key: g,
                    label: tGlobal(`constant.mark_type.${g}`),
                    icon: {
                        auto: LightBulbIcon,
                        bar: (props: SVGProps<SVGSVGElement>) => <svg stroke="currentColor" fill="none" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9,4v16h6v-16Z" /></svg>,
                        line: (props: SVGProps<SVGSVGElement>) => <svg stroke="currentColor" fill="none" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M5,6L19,18" /></svg>,
                        area: (props: SVGProps<SVGSVGElement>) => <svg stroke="none" fill="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M5,20v-17l14,4V20Z" /></svg>,
                        trail: (props: SVGProps<SVGSVGElement>) => <svg stroke="none" fill="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M5,6l7,4l7-2v2l-7,4l-7,-4z" /></svg>,
                        point: (props: SVGProps<SVGSVGElement>) => <svg stroke="currentColor" fill="none" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9,12 A3,3,0,0,1,16,12 A3,3,0,0,1,9,12" /></svg>,
                        circle: (props: SVGProps<SVGSVGElement>) => <svg stroke="none" fill="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6,12 A6,6,0,0,1,18,12 A6,6,0,0,1,6,12" /></svg>,
                        tick: (props: SVGProps<SVGSVGElement>) => <svg stroke="currentColor" fill="none" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M5,12h14" /></svg>,
                        rect: (props: SVGProps<SVGSVGElement>) => <svg stroke="none" fill="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M5,5v14h14v-14z" /></svg>,
                        arc: (props: SVGProps<SVGSVGElement>) => <svg stroke="none" fill="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12,21l-9,-15a12,12,0,0,1,18,0Z" /></svg>,
                        boxplot: (props: SVGProps<SVGSVGElement>) => <svg stroke="currentColor" fill="none" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M7,7v9h10v-9Zm0,4h8M12,7v-6m-3,0h6M12,16v7m-3,0h6" /></svg>,
                    }[g],
                })),
                value: markType,
                onSelect: value => {
                    vizStore.setVisualConfig('geoms', [value]);
                },
            },
            {
                key: 'stack_mode',
                label: tGlobal('constant.stack_mode.__enum__'),
                icon: Square3Stack3DIcon,
                options: STACK_MODE.map(g => ({
                    key: g,
                    label: tGlobal(`constant.stack_mode.${g}`),
                    icon: {
                        none: XMarkIcon,
                        stack: ChevronDoubleUpIcon,
                        normalize: ArrowsUpDownIcon,
                    }[g],
                })),
                value: stack,
                onSelect: value => {
                    vizStore.setVisualConfig('stack', value as IStackMode);
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
            '-',
            {
                key: 'axes_resize',
                label: t('toggle.axes_resize'),
                icon: ChevronUpDownIcon,
                checked: interactiveScale,
                onChange: checked => {
                    vizStore.setVisualConfig('interactiveScale', checked);
                },
            },
            {
                key: 'scale',
                icon: ArrowsPointingOutIcon,
                label: tGlobal(`constant.layout_type.__enum__`),
                options: CHART_LAYOUT_TYPE.map(g => ({
                    key: g,
                    label: tGlobal(`constant.layout_type.${g}`),
                    icon: g === 'auto' ? LockClosedIcon : LockOpenIcon,
                })),
                value: sizeMode,
                onSelect: key => {
                    vizStore.setChartLayout({ mode: key as 'fixed' | 'auto' });
                },
                form: (
                    <FormContainer>
                        <ResizeDialog
                            width={width}
                            height={height}
                            onHeightChange={(v) => {
                                vizStore.setChartLayout({
                                    mode: "fixed",
                                    height: v
                                });
                            }}
                            onWidthChange={(v) => {
                                vizStore.setChartLayout({
                                    mode: "fixed",
                                    width: v
                                });
                            }}
                        />
                    </FormContainer>
                ),
            },
            '-',
            {
                key: 'exploration_mode',
                icon: ViewfinderCircleIcon,
                label: tGlobal(`constant.exploration_mode.__enum__`),
                options: EXPLORATION_TYPES.map(g => ({
                    key: g,
                    label: tGlobal(`constant.exploration_mode.${g}`),
                    icon: {
                        none: ChatBubbleBottomCenterTextIcon,
                        brush: PaintBrushIcon,
                        point: CursorArrowRaysIcon,
                    }[g],
                })),
                value: explorationMode,
                onSelect: key => {
                    vizStore.setExploration({
                        mode: key as (typeof EXPLORATION_TYPES)[number]
                    });
                },
                form: explorationMode === 'brush' ? (
                    <FormContainer>
                        <label
                            id="dropdown:brush_mode:label"
                            htmlFor="dropdown:brush_mode"
                        >
                            {tGlobal(`constant.brush_mode.__enum__`)}
                        </label>
                        <select
                            className="border border-gray-500 rounded-sm text-xs pt-0.5 pb-0.5 pl-2 pr-2 cursor-pointer"
                            id="dropdown:brush_mode"
                            aria-describedby="dropdown:brush_mode:label"
                            disabled={explorationMode !== 'brush'}
                            aria-disabled={explorationMode !== 'brush'}
                            value={brushDirection}
                            onChange={e => {
                                vizStore.setExploration({
                                    brushDirection: e.target.value as IBrushDirection
                                });
                            }}
                        >
                            {BRUSH_DIRECTIONS.map(g => (
                                <option
                                    key={g}
                                    value={g}
                                    className="cursor-pointer"
                                    aria-selected={brushDirection === g}
                                >
                                    {tGlobal(`constant.brush_mode.${g}`)}
                                </option>
                            ))}
                        </select>
                    </FormContainer>
                ) : undefined,
            },
            {
                key: 'debug',
                label: t('toggle.debug'),
                icon: WrenchIcon,
                checked: showActions,
                onChange: checked => {
                    vizStore.setVisualConfig('showActions', checked);
                },
            },
            {
                key: 'export_chart',
                label: t('button.export_chart'),
                icon: PhotoIcon,
                form: (
                    <FormContainer className={dark ? 'dark' : ''}>
                        <button
                            className={`text-xs pt-1 pb-1 pl-6 pr-6 ${dark ? 'dark bg-zinc-900 text-gray-100 hover:bg-gray-700' : 'bg-white hover:bg-gray-200 text-gray-800'}`}
                            aria-label={t('button.export_chart_as', { type: 'png' })}
                            onClick={() => downloadPNG()}
                        >
                            {t('button.export_chart_as', { type: 'png' })}
                        </button>
                        <button
                            className={`text-xs pt-1 pb-1 pl-6 pr-6 ${dark ? 'dark bg-zinc-900 text-gray-100 hover:bg-gray-700' : 'bg-white hover:bg-gray-200 text-gray-800'}`}
                            aria-label={t('button.export_chart_as', { type: 'svg' })}
                            onClick={() => downloadSVG()}
                        >
                            {t('button.export_chart_as', { type: 'svg' })}
                        </button>
                    </FormContainer>
                ),
            },
            {
                key: 'export_code',
                label: t('button.export_code'),
                icon: CodeBracketSquareIcon,
                onClick: () => {
                    commonStore.setShowCodeExportPanel(true);
                }
            }
        ] as ToolbarItemProps[];
    }, [vizStore, canUndo, canRedo, defaultAggregated, markType, stack, interactiveScale, sizeMode, width, height, explorationMode, brushDirection, showActions, downloadPNG, downloadSVG, dark]);

    return <div className="mx-[0.12em] mt-[0.38em] mb-[0.2em]">
        <Toolbar
            darkModePreference={darkModePreference}
            items={items}
            overflowMode="scroll"
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
}

export default observer(VisualSettings);