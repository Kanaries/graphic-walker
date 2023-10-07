import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { runInAction, toJS } from 'mobx';
import { useTranslation } from 'react-i18next';
import { SketchPicker } from 'react-color';

import { useGlobalStore } from '../../store';
import { GLOBAL_CONFIG } from '../../config';
import { IConfigScale, IVisualConfig } from '../../interfaces';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';

import Modal from '../modal';
import Toggle from '../toggle';
import DropdownSelect from '../dropdownSelect';
import { ColorSchemes, extractRGBA } from './colorScheme';
import { RangeScale } from './range-scale';
import { ConfigItemContainer, ConfigItemContent, ConfigItemHeader, ConfigItemTitle } from './config-item';

const DEFAULT_COLOR_SCHEME = ['#5B8FF9', '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3', '#ABB8C3', '#EB144C', '#F78DA7', '#9900EF'];

function useScale(minRange: number, maxRange: number, defaultMinRange?: number, defaultMaxRange?: number) {
    const [enableMinDomain, setEnableMinDomain] = useState(false);
    const [enableMaxDomain, setEnableMaxDomain] = useState(false);
    const [enableRange, setEnableRange] = useState(false);
    const [domainMin, setDomainMin] = useState(0);
    const [domainMax, setDomainMax] = useState(100);
    const [rangeMin, setRangeMin] = useState(defaultMinRange ?? minRange);
    const [rangeMax, setRangeMax] = useState(defaultMaxRange ?? maxRange);
    const setValue = useCallback((value: IConfigScale) => {
        setEnableMaxDomain(value.domainMax !== undefined);
        setEnableMinDomain(value.domainMin !== undefined);
        setEnableRange(value.rangeMax !== undefined || value.rangeMin !== undefined);
        setDomainMin(value.domainMin ?? 0);
        setDomainMax(value.domainMax ?? 100);
        setRangeMax(value.rangeMax ?? defaultMaxRange ?? maxRange);
        setRangeMin(value.rangeMin ?? defaultMinRange ?? minRange);
    }, []);

    const value = useMemo(
        () => ({
            ...(enableMaxDomain ? { domainMax } : {}),
            ...(enableMinDomain ? { domainMin } : {}),
            ...(enableRange ? { rangeMax, rangeMin } : {}),
        }),
        [enableMaxDomain && domainMax, enableMinDomain && domainMin, enableRange && rangeMax, enableRange && rangeMin]
    );

    return {
        value,
        setValue,
        enableMaxDomain,
        enableMinDomain,
        enableRange,
        rangeMax,
        rangeMin,
        domainMax,
        domainMin,
        setEnableMinDomain,
        setEnableMaxDomain,
        setEnableRange,
        setDomainMin,
        setDomainMax,
        setRangeMin,
        setRangeMax,
    };
}

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
    const [colorEdited, setColorEdited] = useState(false);
    const [displayColorPicker, setDisplayColorPicker] = useState(false);
    const [colorPalette, setColorPalette] = useState('');
    const opacityValue = useScale(0, 1, 0.3, 0.8);
    const sizeValue = useScale(0, 100);

    useEffect(() => {
        setZeroScale(visualConfig.zeroScale);
        setBackground(visualConfig.background);
        setResolve(toJS(visualConfig.resolve));
        setDefaultColor(extractRGBA(visualConfig.primaryColor));
        setColorEdited(false);
        setScaleIncludeUnmatchedChoropleth(visualConfig.scaleIncludeUnmatchedChoropleth ?? false);
        setFormat({
            numberFormat: visualConfig.format.numberFormat,
            timeFormat: visualConfig.format.timeFormat,
            normalizedNumberFormat: visualConfig.format.normalizedNumberFormat,
        });
        setColorPalette(visualConfig.colorPalette ?? '');
        opacityValue.setValue(visualConfig.scale?.opacity ?? {});
        sizeValue.setValue(visualConfig.scale?.size ?? {});
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
                <ConfigItemContainer>
                    <ConfigItemHeader>
                        <ConfigItemTitle>Colors</ConfigItemTitle>
                    </ConfigItemHeader>
                    <ConfigItemContent>
                        <div className="flex space-x-6">
                            <div>
                                <label className="block text-xs font-medium leading-6">{t('config.primary_color')}</label>
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
                                    <div className="absolute left-32 top-22 z-40">
                                        {displayColorPicker && (
                                            <SketchPicker
                                                presetColors={DEFAULT_COLOR_SCHEME}
                                                color={defaultColor}
                                                onChange={(color, event) => {
                                                    setColorEdited(true);
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
                            <div>
                                <label className="block text-xs font-medium leading-6">{t('config.color_palette')}</label>
                                <DropdownSelect
                                    buttonClassName="w-48"
                                    selectedKey={colorPalette}
                                    onSelect={setColorPalette}
                                    options={ColorSchemes.map((scheme) => ({
                                        value: scheme.name,
                                        label: (
                                            <>
                                                <div key={scheme.name} className="flex flex-col justify-start items-center">
                                                    <div className="font-light">{scheme.name}</div>
                                                    <div className="flex w-full">
                                                        {scheme.value.map((c, index) => {
                                                            return <div key={index} className="w-4 h-4 flex-shrink" style={{ backgroundColor: `${c}` }}></div>;
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        ),
                                    })).concat({
                                        value: '',
                                        label: <>{t('config.default_color_palette')}</>,
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium leading-6">{t('config.background')} {t(`config.color`)}</label>
                                <input
                                    type="text"
                                    className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                    value={background ?? ''}
                                    onChange={(e) => {
                                        setBackground(e.target.value);
                                    }}
                                />
                            </div>
                        </div>
                    </ConfigItemContent>
                </ConfigItemContainer>
                <ConfigItemContainer>
                    <ConfigItemHeader>
                        <ConfigItemTitle>Scale</ConfigItemTitle>
                    </ConfigItemHeader>
                    <ConfigItemContent>
                        <div>
                            <label className="block text-xs font-medium leading-6">{t('config.opacity')}</label>
                            <RangeScale {...opacityValue} text="opacity" maxRange={1} minRange={0} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium leading-6">{t('config.size')}</label>
                            <RangeScale {...sizeValue} text="size" maxRange={100} minRange={0} />
                        </div>
                    </ConfigItemContent>
                </ConfigItemContainer>
                <ConfigItemContainer>
                    <ConfigItemHeader>
                        <ConfigItemTitle>{t('config.format')}</ConfigItemTitle>
                        <p className="text-xs">
                            {t(`config.formatGuidesDocs`)}:{' '}
                            <a target="_blank" className="underline text-blue-500" href="https://github.com/d3/d3-format#locale_format">
                                {t(`config.readHere`)}
                            </a>
                        </p>
                    </ConfigItemHeader>
                    <ConfigItemContent>
                        <div className="flex gap-4">
                            {formatConfigList.map((fc) => (
                                <div className="my-2" key={fc}>
                                    <label className="block text-xs font-medium leading-6">{t(`config.${fc}`)}</label>
                                    <div className="mt-1">
                                        <input
                                            type="text"
                                            className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
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
                        </div>
                    </ConfigItemContent>
                </ConfigItemContainer>
                <ConfigItemContainer>
                    <ConfigItemHeader>
                        <ConfigItemTitle>{t('config.independence')}</ConfigItemTitle>
                        <p className="text-xs">
                            {t(`config.formatGuidesDocs`)}:{' '}
                            <a target="_blank" className="underline text-blue-500" href="https://docs.kanaries.net">
                                {t(`config.readHere`)}
                            </a>
                        </p>
                    </ConfigItemHeader>
                    <ConfigItemContent>
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
                    </ConfigItemContent>
                </ConfigItemContainer>
                <ConfigItemContainer>
                    <ConfigItemHeader>
                        <ConfigItemTitle>{t('config.misc')}</ConfigItemTitle>
                    </ConfigItemHeader>
                    <ConfigItemContent>
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
                            <Toggle
                                label="include unmatched choropleth in scale"
                                enabled={scaleIncludeUnmatchedChoropleth}
                                onChange={(en) => {
                                    setScaleIncludeUnmatchedChoropleth(en);
                                }}
                            />
                        </div>
                    </ConfigItemContent>
                </ConfigItemContainer>

                <div className="m-4">
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
                                if (colorEdited) {
                                    vizStore.setVisualConfig('primaryColor', `rgba(${defaultColor.r},${defaultColor.g},${defaultColor.b},${defaultColor.a})`);
                                }
                                vizStore.setVisualConfig('colorPalette', colorPalette);
                                vizStore.setVisualConfig('useSvg', svg);
                                vizStore.setVisualConfig('scale', { opacity: opacityValue.value, size: sizeValue.value });
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
