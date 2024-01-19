import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { useTranslation } from 'react-i18next';
import { SketchPicker } from 'react-color';

import { useVizStore } from '../../store';
import { GLOBAL_CONFIG } from '../../config';
import { IConfigScale, IVisualConfig, IVisualLayout } from '../../interfaces';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';

import Modal from '../modal';
import Toggle from '../toggle';
import DropdownSelect from '../dropdownSelect';
import { ColorSchemes, extractRGBA } from './colorScheme';
import { RangeScale } from './range-scale';
import { ConfigItemContainer, ConfigItemContent, ConfigItemHeader, ConfigItemTitle } from './config-item';
import { KVTuple } from '../../models/utils';
import { isNotEmpty } from '../../utils';
import { timezones } from './timezone';

const DEFAULT_COLOR_SCHEME = ['#5B8FF9', '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3', '#ABB8C3', '#EB144C', '#F78DA7', '#9900EF'];

function useScale(minRange: number, maxRange: number, defaultMinRange?: number, defaultMaxRange?: number) {
    const [enableMinDomain, setEnableMinDomain] = useState(false);
    const [enableMaxDomain, setEnableMaxDomain] = useState(false);
    const [enableRange, setEnableRange] = useState(false);
    const [domainMin, setDomainMin] = useState(0);
    const [domainMax, setDomainMax] = useState(100);
    const [rangeMin, setRangeMin] = useState(defaultMinRange ?? minRange);
    const [rangeMax, setRangeMax] = useState(defaultMaxRange ?? maxRange);
    const setValue = useCallback(
        (value: IConfigScale) => {
            setEnableMaxDomain(isNotEmpty(value.domainMax));
            setEnableMinDomain(isNotEmpty(value.domainMin));
            setEnableRange(isNotEmpty(value.rangeMax) || isNotEmpty(value.rangeMin));
            setDomainMin(value.domainMin ?? 0);
            setDomainMax(value.domainMax ?? 100);
            setRangeMax(value.rangeMax ?? defaultMaxRange ?? maxRange);
            setRangeMin(value.rangeMin ?? defaultMinRange ?? minRange);
        },
        [defaultMaxRange, defaultMinRange, maxRange, minRange]
    );

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

const VisualConfigPanel: React.FC = () => {
    const vizStore = useVizStore();
    const { layout, showVisualConfigPanel, config } = vizStore;
    const { t } = useTranslation();
    const formatConfigList: (keyof IVisualConfig['format'])[] = ['numberFormat', 'timeFormat', 'normalizedNumberFormat'];
    const [format, setFormat] = useState<IVisualConfig['format']>({
        numberFormat: layout.format.numberFormat,
        timeFormat: layout.format.timeFormat,
        normalizedNumberFormat: layout.format.normalizedNumberFormat,
    });
    const [resolve, setResolve] = useState<IVisualConfig['resolve']>({
        x: layout.resolve.x,
        y: layout.resolve.y,
        color: layout.resolve.color,
        opacity: layout.resolve.opacity,
        shape: layout.resolve.shape,
        size: layout.resolve.size,
    });
    const [zeroScale, setZeroScale] = useState<boolean>(layout.zeroScale);
    const [svg, setSvg] = useState<boolean>(layout.useSvg ?? false);
    const [scaleIncludeUnmatchedChoropleth, setScaleIncludeUnmatchedChoropleth] = useState<boolean>(layout.scaleIncludeUnmatchedChoropleth ?? false);
    const [background, setBackground] = useState<string | undefined>(layout.background);
    const [defaultColor, setDefaultColor] = useState({ r: 91, g: 143, b: 249, a: 1 });
    const [colorEdited, setColorEdited] = useState(false);
    const [displayColorPicker, setDisplayColorPicker] = useState(false);
    const [colorPalette, setColorPalette] = useState('');
    const [geoMapTileUrl, setGeoMapTileUrl] = useState<string | undefined>(undefined);
    const [displayOffset, setDisplayOffset] = useState<number | undefined>(undefined);
    const [displayOffsetEdited, setDisplayOffsetEdited] = useState(false);

    const opacityValue = useScale(0, 1, 0.3, 0.8);
    const sizeValue = useScale(0, 100);

    useEffect(() => {
        setZeroScale(layout.zeroScale);
        setSvg(layout.useSvg ?? false);
        setBackground(layout.background);
        setResolve(layout.resolve);
        setDefaultColor(extractRGBA(layout.primaryColor));
        setColorEdited(false);
        setScaleIncludeUnmatchedChoropleth(layout.scaleIncludeUnmatchedChoropleth ?? false);
        setFormat({
            numberFormat: layout.format.numberFormat,
            timeFormat: layout.format.timeFormat,
            normalizedNumberFormat: layout.format.normalizedNumberFormat,
        });
        setColorPalette(layout.colorPalette ?? '');
        opacityValue.setValue(layout.scale?.opacity ?? {});
        sizeValue.setValue(layout.scale?.size ?? {});
        setGeoMapTileUrl(layout.geoMapTileUrl);
        setDisplayOffset(config.timezoneDisplayOffset);
        setDisplayOffsetEdited(false);
    }, [showVisualConfigPanel]);

    return (
        <Modal
            show={showVisualConfigPanel}
            onClose={() => {
                vizStore.setShowVisualConfigPanel(false);
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
                                                onChange={(color) => {
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
                                <label className="block text-xs font-medium leading-6">
                                    {t('config.background')} {t(`config.color`)}
                                </label>
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
                        <div className="flex flex-col space-y-2">
                            <div className="flex flex-col space-y-2">
                                <Toggle
                                    label={t(`config.customTile`)}
                                    enabled={isNotEmpty(geoMapTileUrl)}
                                    onChange={(e) => {
                                        setGeoMapTileUrl(e ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : undefined);
                                    }}
                                />
                                {isNotEmpty(geoMapTileUrl) && (
                                    <input
                                        type="text"
                                        className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                        value={geoMapTileUrl}
                                        onChange={(e) => {
                                            setGeoMapTileUrl(e.target.value);
                                        }}
                                    />
                                )}
                            </div>
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
                            <div className="flex flex-col space-y-2">
                                <Toggle
                                    label={t(`config.customOffset`)}
                                    enabled={isNotEmpty(displayOffset)}
                                    onChange={(e) => {
                                        setDisplayOffsetEdited(true);
                                        setDisplayOffset(e ? new Date().getTimezoneOffset() : undefined);
                                    }}
                                />
                                {isNotEmpty(displayOffset) && (
                                    <DropdownSelect
                                        className="w-full "
                                        buttonClassName="w-full"
                                        selectedKey={`${displayOffset}`}
                                        onSelect={(e) => {
                                            setDisplayOffsetEdited(true);
                                            setDisplayOffset(parseInt(e));
                                        }}
                                        options={timezones.map((tz) => ({
                                            value: `${tz.value}`,
                                            label: <span title={tz.name}>{tz.name}</span>,
                                        }))}
                                    />
                                )}
                            </div>
                        </div>
                    </ConfigItemContent>
                </ConfigItemContainer>

                <div className="m-4">
                    <PrimaryButton
                        text={t('actions.confirm')}
                        className="mr-2"
                        onClick={() => {
                            runInAction(() => {
                                vizStore.setVisualLayout(
                                    ['format', format],
                                    ['zeroScale', zeroScale],
                                    ['scaleIncludeUnmatchedChoropleth', scaleIncludeUnmatchedChoropleth],
                                    ['background', background],
                                    ['resolve', resolve],
                                    ['colorPalette', colorPalette],
                                    ['useSvg', svg],
                                    ['scale', { opacity: opacityValue.value, size: sizeValue.value }],
                                    ...(colorEdited
                                        ? [
                                              [
                                                  'primaryColor',
                                                  `rgba(${defaultColor.r},${defaultColor.g},${defaultColor.b},${defaultColor.a})`,
                                              ] as KVTuple<IVisualLayout>,
                                          ]
                                        : []),
                                    ['geoMapTileUrl', geoMapTileUrl]
                                );
                                displayOffsetEdited && vizStore.setVisualConfig('timezoneDisplayOffset', displayOffset);
                                vizStore.setShowVisualConfigPanel(false);
                            });
                        }}
                    />
                    <DefaultButton
                        text={t('actions.cancel')}
                        className="mr-2"
                        onClick={() => {
                            vizStore.setShowVisualConfigPanel(false);
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default observer(VisualConfigPanel);
