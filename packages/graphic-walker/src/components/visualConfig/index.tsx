import React, { useEffect, useState, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { runInAction, toJS } from 'mobx';
import { useTranslation } from 'react-i18next';
import { SketchPicker } from 'react-color';

import { useGlobalStore } from '../../store';
import { GLOBAL_CONFIG } from '../../config';
import { IVisualConfig } from '../../interfaces';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';

import Modal from '../modal';
import Toggle from '../toggle';

const DEFAULT_COLOR_SCHEME = [
    '#5B8FF9',
    '#FF6900',
    '#FCB900',
    '#7BDCB5',
    '#00D084',
    '#8ED1FC',
    '#0693E3',
    '#ABB8C3',
    '#EB144C',
    '#F78DA7',
    '#9900EF',
]

const VisualConfigPanel: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showVisualConfigPanel } = commonStore;
    const { visualConfig } = vizStore;
    const {
        coordSystem,
        geoms: [markType],
    } = visualConfig;
    const isChoropleth = coordSystem === 'geographic' && markType === 'choropleth';
    const { t } = useTranslation();
    const formatConfigList: (keyof IVisualConfig['format'])[] = ['numberFormat', 'timeFormat', 'normalizedNumberFormat'];
    const [format, setFormat] = useState<IVisualConfig['format']>({
        numberFormat: visualConfig.format.numberFormat,
        timeFormat: visualConfig.format.timeFormat,
        normalizedNumberFormat: visualConfig.format.normalizedNumberFormat,
    });
    const [resolve, setResolve] = useState<IVisualConfig['resolve']>({
        x: visualConfig.resolve.x,
        y: visualConfig.resolve.y,
        color: visualConfig.resolve.color,
        opacity: visualConfig.resolve.opacity,
        shape: visualConfig.resolve.shape,
        size: visualConfig.resolve.size,
    });
    const [zeroScale, setZeroScale] = useState<boolean>(visualConfig.zeroScale);
    const [svg, setSvg] = useState<boolean>(visualConfig.useSvg ?? false);
    const [scaleIncludeUnmatchedChoropleth, setScaleIncludeUnmatchedChoropleth] = useState<boolean>(visualConfig.scaleIncludeUnmatchedChoropleth ?? false);
    const [background, setBackground] = useState<string | undefined>(visualConfig.background);
    const [defaultColor, setDefaultColor] = useState({ r: 91, g: 143, b: 249, a: 1 });
    const [displayColorPicker, setDisplayColorPicker] = useState(false);

    const extractRGBA = useCallback((rgba?: string) => {
        if (!rgba) {
            return { r: 0, g: 0, b: 0, a: 0 };
        }

        const arr = rgba.match(/\d+/g) || [];
        const [r = 0, g = 0, b = 0, a = 0] = arr.map(Number);
        return { r, g, b, a };
    }, []);

    useEffect(() => {
        setZeroScale(visualConfig.zeroScale);
        setBackground(visualConfig.background);
        setResolve(toJS(visualConfig.resolve));
        setDefaultColor(extractRGBA(visualConfig.primaryColor));
        setScaleIncludeUnmatchedChoropleth(visualConfig.scaleIncludeUnmatchedChoropleth ?? false);
        setFormat({
            numberFormat: visualConfig.format.numberFormat,
            timeFormat: visualConfig.format.timeFormat,
            normalizedNumberFormat: visualConfig.format.normalizedNumberFormat,
        });
    }, [showVisualConfigPanel]);

    return (
        <Modal
            show={showVisualConfigPanel}
            onClose={() => {
                commonStore.setShowVisualConfigPanel(false);
            }}
        >
            <div
                onClick={() => {
                    setDisplayColorPicker(false);
                }}
            >
                <div className="mb-2">
                    <h2 className="text-lg mb-4">Scheme</h2>
                    <div className="flex">
                        <p className="w-28">Primary Color</p>
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                            }}
                        >
                            <div
                                className="w-8 h-5 border-2"
                                style={{ backgroundColor: `rgba(${defaultColor.r},${defaultColor.g},${defaultColor.b},${defaultColor.a})` }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setDisplayColorPicker(true);
                                }}
                            ></div>
                            <div className="absolute left-32 top-22 index-40">
                                {displayColorPicker && (
                                    <SketchPicker
                                        presetColors={DEFAULT_COLOR_SCHEME}
                                        color={defaultColor}
                                        onChange={(color, event) => {
                                            setDefaultColor({
                                                ...color.rgb,
                                                a: color.rgb.a ?? 1,
                                            });
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* {ColorSchemes.map((scheme) => {
                        return (
                            <div key={scheme.name} className="flex justify-start items-center">
                                <div className="font-light mx-2 w-24 ">{scheme.name}</div>
                                {scheme.value.map((c, index) => {
                                    return <div key={index} className="w-4 h-4" style={{ backgroundColor: `${c}` }}></div>;
                                })}
                            </div>
                        );
                    })} */}
                </div>
                <h2 className="text-lg mb-4">{t('config.format')}</h2>
                <p className="text-xs">
                    {t(`config.formatGuidesDocs`)}:{' '}
                    <a target="_blank" className="underline text-blue-500" href="https://github.com/d3/d3-format#locale_format">
                        {t(`config.readHere`)}
                    </a>
                </p>
                {formatConfigList.map((fc) => (
                    <div className="my-2" key={fc}>
                        <label className="block text-xs font-medium leading-6">{t(`config.${fc}`)}</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                value={format[fc] ?? ''}
                                onChange={(e) => {
                                    setFormat((f) => ({
                                        ...f,
                                        [fc]: e.target.value,
                                    }));
                                }}
                            />
                        </div>
                    </div>
                ))}
                <hr className="my-4" />
                <div className="my-2">
                    <label className="block text-xs font-medium leading-6">
                        {t('config.background')} {t(`config.color`)}
                    </label>
                    <div className="mt-1">
                        <input
                            type="text"
                            className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                            value={background ?? ''}
                            onChange={(e) => {
                                setBackground(e.target.value);
                            }}
                        />
                    </div>
                </div>
                <label className="block text-xs font-medium leading-6">{t('config.independence')}</label>
                <div className="my-2">
                    <div className="flex space-x-6">
                        {GLOBAL_CONFIG.POSITION_CHANNEL_CONFIG_LIST.map((pc) => (
                            <Toggle
                                label={t(`config.${pc}`)}
                                key={pc}
                                enabled={resolve[pc] ?? false}
                                onChange={(e) => {
                                    setResolve((r) => ({
                                        ...r,
                                        [pc]: e,
                                    }));
                                }}
                            />
                        ))}
                        {GLOBAL_CONFIG.NON_POSITION_CHANNEL_CONFIG_LIST.map((npc) => (
                            <Toggle
                                label={t(`constant.draggable_key.${npc}`)}
                                key={npc}
                                enabled={resolve[npc] ?? false}
                                onChange={(e) => {
                                    setResolve((r) => ({
                                        ...r,
                                        [npc]: e,
                                    }));
                                }}
                            />
                        ))}
                    </div>
                </div>
                <label className="block text-xs font-medium leading-6">{t('config.misc')}</label>
                <div className="my-2">
                    <div className="flex space-x-6">
                        <Toggle
                            label={t(`config.zeroScale`)}
                            enabled={zeroScale}
                            onChange={(en) => {
                                setZeroScale(en);
                            }}
                        />
                        <Toggle
                            label={t(`config.svg`)}
                            enabled={svg}
                            onChange={(en) => {
                                setSvg(en);
                            }}
                        />
                        {isChoropleth && (
                            <Toggle
                                label="include unmatched choropleth in scale"
                                enabled={scaleIncludeUnmatchedChoropleth}
                                onChange={(en) => {
                                    setScaleIncludeUnmatchedChoropleth(en);
                                }}
                            />
                        )}
                    </div>
                </div>
                <div className="mt-4">
                    <PrimaryButton
                        text={t('actions.confirm')}
                        className="mr-2"
                        onClick={() => {
                            runInAction(() => {
                                vizStore.setVisualConfig('format', format);
                                vizStore.setVisualConfig('zeroScale', zeroScale);
                                vizStore.setVisualConfig('scaleIncludeUnmatchedChoropleth', scaleIncludeUnmatchedChoropleth);
                                vizStore.setVisualConfig('background', background);
                                vizStore.setVisualConfig('resolve', resolve);
                                vizStore.setVisualConfig('primaryColor', `rgba(${defaultColor.r},${defaultColor.g},${defaultColor.b},${defaultColor.a})`);
                                vizStore.setVisualConfig('useSvg', svg);
                                commonStore.setShowVisualConfigPanel(false);
                            });
                        }}
                    />
                    <DefaultButton
                        text={t('actions.cancel')}
                        className="mr-2"
                        onClick={() => {
                            commonStore.setShowVisualConfigPanel(false);
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default observer(VisualConfigPanel);
