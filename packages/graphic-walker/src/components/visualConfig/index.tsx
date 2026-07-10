import React, { useEffect, useState, useMemo, useCallback, useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { runInAction, set } from 'mobx';
import { useTranslation } from 'react-i18next';

import { useVizStore } from '../../store';
import { GLOBAL_CONFIG } from '../../config';
import { IConfigScale, IVisualConfig, IVisualLayout, IThemeKey } from '../../interfaces';
import Toggle from '../toggle';
import { ColorSchemes, extractRGBA } from './colorScheme';
import { DomainScale, RangeScale } from './range-scale';
import { ConfigItemContainer, ConfigItemContent, ConfigItemDescription, ConfigItemHeader, ConfigItemTitle } from './config-item';
import { KVTuple } from '../../models/utils';
import { isNotEmpty } from '../../utils';
import { timezones } from './timezone';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogNormalContent } from '../ui/dialog';
import Combobox from '../dropdownSelect/combobox';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { vegaThemeContext } from '../../store/theme';
import { ColorPickerComponent } from './color-picker';
import { Switch } from '../ui/switch';

function SettingRow(props: { title: React.ReactNode; description?: React.ReactNode; htmlFor?: string; children?: React.ReactNode }) {
    return (
        <div className="p-4 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
            <div className="flex-1 min-w-0 max-w-md">
                <label htmlFor={props.htmlFor} className="text-xs font-medium leading-6">
                    {props.title}
                </label>
                {props.description && <p className="text-xs text-muted-foreground">{props.description}</p>}
            </div>
            <div className="shrink-0 self-end sm:self-auto">{props.children}</div>
        </div>
    );
}

function useDomainScale() {
    const [enableMinDomain, setEnableMinDomain] = useState(false);
    const [enableMaxDomain, setEnableMaxDomain] = useState(false);
    const [domainMin, setDomainMin] = useState(0);
    const [domainMax, setDomainMax] = useState(100);
    const [enableType, setEnableType] = useState(false);
    const [type, setType] = useState<'linear' | 'log' | 'pow' | 'sqrt' | 'symlog'>('linear');
    const setValue = useCallback((value: IConfigScale) => {
        setEnableMaxDomain(isNotEmpty(value.domainMax));
        setEnableMinDomain(isNotEmpty(value.domainMin));
        setEnableType(isNotEmpty(value.type));
        setDomainMin(value.domainMin ?? 0);
        setDomainMax(value.domainMax ?? 100);
        setType(value.type ?? 'linear');
    }, []);

    const value = useMemo(
        () => ({
            ...(enableType ? { type } : {}),
            ...(enableMaxDomain ? { domainMax } : {}),
            ...(enableMinDomain ? { domainMin } : {}),
        }),
        [enableMaxDomain && domainMax, enableMinDomain && domainMin, enableType && type]
    );
    return {
        value,
        setValue,
        enableMaxDomain,
        enableMinDomain,
        domainMax,
        domainMin,
        setEnableMinDomain,
        setEnableMaxDomain,
        setDomainMin,
        setDomainMax,
        enableType,
        type,
        setType,
        setEnableType,
    };
}

function useScale(minRange: number, maxRange: number, defaultMinRange?: number, defaultMaxRange?: number) {
    const [enableMinDomain, setEnableMinDomain] = useState(false);
    const [enableMaxDomain, setEnableMaxDomain] = useState(false);
    const [enableRange, setEnableRange] = useState(false);
    const [domainMin, setDomainMin] = useState(0);
    const [domainMax, setDomainMax] = useState(100);
    const [rangeMin, setRangeMin] = useState(defaultMinRange ?? minRange);
    const [rangeMax, setRangeMax] = useState(defaultMaxRange ?? maxRange);
    const [enableType, setEnableType] = useState(false);
    const [type, setType] = useState<'linear' | 'log' | 'pow' | 'sqrt' | 'symlog'>('linear');

    const setValue = useCallback(
        (value: IConfigScale) => {
            setEnableMaxDomain(isNotEmpty(value.domainMax));
            setEnableMinDomain(isNotEmpty(value.domainMin));
            setEnableRange(isNotEmpty(value.rangeMax) || isNotEmpty(value.rangeMin));
            setEnableType(isNotEmpty(value.type));
            setDomainMin(value.domainMin ?? 0);
            setDomainMax(value.domainMax ?? 100);
            setRangeMax(value.rangeMax ?? defaultMaxRange ?? maxRange);
            setRangeMin(value.rangeMin ?? defaultMinRange ?? minRange);
            setType(value.type ?? 'linear');
        },
        [defaultMaxRange, defaultMinRange, maxRange, minRange]
    );

    const value = useMemo(
        () => ({
            ...(enableType ? { type } : {}),
            ...(enableMaxDomain ? { domainMax } : {}),
            ...(enableMinDomain ? { domainMin } : {}),
            ...(enableRange ? { rangeMax, rangeMin } : {}),
        }),
        [enableMaxDomain && domainMax, enableMinDomain && domainMin, enableRange && rangeMax, enableRange && rangeMin, enableType && type]
    );

    return {
        type,
        setType,
        enableType,
        setEnableType,
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
    const [showAllGeoshapeInChoropleth, setShowAllGeoshapeInChoropleth] = useState<boolean>(layout.showAllGeoshapeInChoropleth ?? false);
    const [renderer, setRenderer] = useState<'vega-lite' | 'observable-plot'>(layout.renderer ?? 'vega-lite');
    const [background, setBackground] = useState({ r: 255, g: 255, b: 255, a: 0 });
    const [defaultColor, setDefaultColor] = useState({ r: 91, g: 143, b: 249, a: 1 });
    const [primaryColorEdited, setPrimaryColorEdited] = useState(false);
    const [backgroundEdited, setBackgroundEdited] = useState(false);
    const [displayColorPicker, setDisplayColorPicker] = useState(false);
    const [displayBackgroundPicker, setDisplayBackgroundPicker] = useState(false);
    const [colorPalette, setColorPalette] = useState('');
    const { vizThemeConfig, setVizThemeConfig } = useContext(vegaThemeContext);
    const [themeKey, setThemeKey] = useState<IThemeKey>(
        typeof vizThemeConfig === 'string' ? vizThemeConfig : 'vega'
    );
    const [geoMapTileUrl, setGeoMapTileUrl] = useState<string | undefined>(undefined);
    const [displayOffset, setDisplayOffset] = useState<number | undefined>(undefined);
    const [displayOffsetEdited, setDisplayOffsetEdited] = useState(false);

    const [enabledScales, setEnabledScales] = useState<string[]>([]);
    const columnValue = useDomainScale();
    const rowValue = useDomainScale();
    const colorValue = useDomainScale();
    const thetaValue = useDomainScale();
    const radiusValue = useDomainScale();
    const opacityValue = useScale(0, 1, 0.3, 0.8);
    const sizeValue = useScale(0, 100);
    const scalesSet = new Set(enabledScales);

    useEffect(() => {
        setZeroScale(layout.zeroScale);
        setSvg(layout.useSvg ?? false);
        setRenderer(layout.renderer ?? 'vega-lite');
        setBackground(
            extractRGBA(
                {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 0,
                },
                layout.background
            )
        );
        setResolve(layout.resolve);
        setDefaultColor(extractRGBA({ r: 91, g: 143, b: 249, a: 1 }, layout.primaryColor));
        setPrimaryColorEdited(false);
        setBackgroundEdited(false);
        setScaleIncludeUnmatchedChoropleth(layout.scaleIncludeUnmatchedChoropleth ?? false);
        setFormat({
            numberFormat: layout.format.numberFormat,
            timeFormat: layout.format.timeFormat,
            normalizedNumberFormat: layout.format.normalizedNumberFormat,
        });
        setColorPalette(layout.colorPalette ?? '');
        setThemeKey(typeof vizThemeConfig === 'string' ? vizThemeConfig : 'vega');
        const enabledScales = Object.entries(layout.scale ?? {})
            .filter(([_k, scale]) => Object.entries(scale).filter(([_k, v]) => !!v).length > 0)
            .map(([k]) => k);
        setEnabledScales(enabledScales.length === 0 ? ['opacity', 'size'] : enabledScales);
        columnValue.setValue(layout.scale?.column ?? {});
        rowValue.setValue(layout.scale?.row ?? {});
        colorValue.setValue(layout.scale?.color ?? {});
        thetaValue.setValue(layout.scale?.theta ?? {});
        radiusValue.setValue(layout.scale?.radius ?? {});
        opacityValue.setValue(layout.scale?.opacity ?? {});
        sizeValue.setValue(layout.scale?.size ?? {});
        setGeoMapTileUrl(layout.geoMapTileUrl);
        setDisplayOffset(config.timezoneDisplayOffset);
        setDisplayOffsetEdited(false);
    }, [showVisualConfigPanel, vizThemeConfig]);

    return (
        <Dialog
            open={showVisualConfigPanel}
            onOpenChange={() => {
                vizStore.setShowVisualConfigPanel(false);
            }}
        >
            <DialogNormalContent
                className="p-0"
                onClick={() => {
                    setDisplayColorPicker(false);
                    setDisplayBackgroundPicker(false);
                }}
            >
                <div className="flex flex-col max-h-[calc(min(800px,90vh))] py-6">
                    <div className="overflow-y-auto flex-shrink-1 min-h-0 px-6">
                        <ConfigItemContainer>
                            <ConfigItemHeader>
                                <ConfigItemTitle>{t('config.colors')}</ConfigItemTitle>
                                <ConfigItemDescription>{t('config.colors_desc')}</ConfigItemDescription>
                            </ConfigItemHeader>
                            <ConfigItemContent>
                                <div className="border rounded-md divide-y">
                                    <SettingRow title={t('config.primary_color')} description={t('config.primary_color_desc')}>
                                        <ColorPickerComponent
                                            defaultColor={defaultColor}
                                            setDefaultColor={setDefaultColor}
                                            setPrimaryColorEdited={setPrimaryColorEdited}
                                            displayColorPicker={displayColorPicker}
                                            setDisplayColorPicker={setDisplayColorPicker}
                                            align="right"
                                        />
                                    </SettingRow>
                                    <SettingRow
                                        title={`${t('config.background')} ${t(`config.color`)}`}
                                        description={t('config.background_desc')}
                                    >
                                        <ColorPickerComponent
                                            defaultColor={background}
                                            setDefaultColor={setBackground}
                                            setPrimaryColorEdited={setBackgroundEdited}
                                            displayColorPicker={displayBackgroundPicker}
                                            setDisplayColorPicker={setDisplayBackgroundPicker}
                                            align="right"
                                        />
                                    </SettingRow>
                                    <SettingRow title={t('config.theme')} description={t('config.theme_desc')}>
                                        <Combobox
                                            className="w-48 h-fit"
                                            popClassName="w-48"
                                            selectedKey={themeKey}
                                            onSelect={(v) => setThemeKey(v as IThemeKey)}
                                            options={[
                                                { value: 'vega', label: 'vega' },
                                                { value: 'g2', label: 'g2' },
                                                { value: 'streamlit', label: 'streamlit' },
                                                { value: 'danqing', label: 'danqing' },
                                                { value: 'sodapop', label: 'sodapop' },
                                            ]}
                                        />
                                    </SettingRow>
                                    <SettingRow title={t('config.color_palette')} description={t('config.color_palette_desc')}>
                                        <Combobox
                                            className="w-48 h-fit"
                                            popClassName="w-48"
                                            selectedKey={colorPalette}
                                            onSelect={setColorPalette}
                                            placeholder={t('config.default_color_palette')}
                                            options={ColorSchemes.map((scheme) => ({
                                                value: scheme.name,
                                                label: (
                                                    <>
                                                        <div key={scheme.name} className="flex flex-col justify-start items-center w-32">
                                                            <div className="font-light">{scheme.name}</div>
                                                            <div className="flex w-full">
                                                                {scheme.value.map((c, index) => {
                                                                    return <div key={index} className="h-4 flex-1" style={{ backgroundColor: `${c}` }}></div>;
                                                                })}
                                                            </div>
                                                        </div>
                                                    </>
                                                ),
                                            })).concat({
                                                value: '_none',
                                                label: <>{t('config.default_color_palette')}</>,
                                            })}
                                        />
                                    </SettingRow>
                                </div>
                            </ConfigItemContent>
                        </ConfigItemContainer>
                        <ConfigItemContainer>
                            <ConfigItemHeader>
                                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4">
                                    <div>
                                        <ConfigItemTitle>{t('config.scale')}</ConfigItemTitle>
                                        <ConfigItemDescription>{t('config.scale_desc')}</ConfigItemDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="shrink-0 self-end sm:self-auto">
                                                {t('config.customize_scales')}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            {['row', 'column', 'color', 'theta', 'radius', 'opacity', 'size'].map((scale) => (
                                                <DropdownMenuCheckboxItem
                                                    key={scale}
                                                    checked={scalesSet.has(scale)}
                                                    onCheckedChange={(e) => {
                                                        if (e) {
                                                            setEnabledScales((s) => [...s, scale]);
                                                        } else {
                                                            setEnabledScales((s) => s.filter((x) => x !== scale));
                                                        }
                                                    }}
                                                >
                                                    {t(`config.${scale}`)}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </ConfigItemHeader>
                            <ConfigItemContent>
                                <div className="flex flex-col gap-4">
                                    {(
                                        [
                                            ['column', <DomainScale {...columnValue} text="column" />],
                                            ['row', <DomainScale {...rowValue} text="row" />],
                                            ['color', <DomainScale {...colorValue} text="color" />],
                                            ['theta', <DomainScale {...thetaValue} text="theta" />],
                                            ['radius', <DomainScale {...radiusValue} text="radius" />],
                                            ['opacity', <RangeScale {...opacityValue} text="opacity" maxRange={1} minRange={0} />],
                                            ['size', <RangeScale {...sizeValue} text="size" maxRange={100} minRange={0} />],
                                        ] as [string, React.ReactNode][]
                                    )
                                        .filter(([key]) => scalesSet.has(key))
                                        .map(([key, control]) => (
                                            <div key={key} className="border rounded-md divide-y">
                                                <div className="p-4">
                                                    <h3 className="text-sm font-medium">{t(`config.${key}`)}</h3>
                                                    <p className="text-xs text-muted-foreground">{t(`config.scale_${key}_desc`)}</p>
                                                </div>
                                                {control}
                                            </div>
                                        ))}
                                    {enabledScales.length === 0 && <p className="text-xs text-muted-foreground">{t('config.scale_empty')}</p>}
                                </div>
                            </ConfigItemContent>
                        </ConfigItemContainer>
                        <ConfigItemContainer>
                            <ConfigItemHeader>
                                <ConfigItemTitle>{t('config.format')}</ConfigItemTitle>
                                <ConfigItemDescription>
                                    {t('config.format_desc')} {t(`config.formatGuidesDocs`)}:{' '}
                                    <a target="_blank" className="hover:underline text-primary" href="https://github.com/d3/d3-format#locale_format">
                                        {t(`config.readHere`)}
                                    </a>
                                    .
                                </ConfigItemDescription>
                            </ConfigItemHeader>
                            <ConfigItemContent>
                                <div className="border rounded-md divide-y">
                                    {formatConfigList.map((fc) => (
                                        <SettingRow key={fc} htmlFor={`format_${fc}`} title={t(`config.${fc}`)} description={t(`config.${fc}_desc`)}>
                                            <Input
                                                id={`format_${fc}`}
                                                className="w-48"
                                                type="text"
                                                placeholder={{ numberFormat: ',.2f', timeFormat: '%Y-%m-%d', normalizedNumberFormat: '.0%' }[fc]}
                                                value={format[fc] ?? ''}
                                                onChange={(e) => {
                                                    setFormat((f) => ({
                                                        ...f,
                                                        [fc]: e.target.value,
                                                    }));
                                                }}
                                            />
                                        </SettingRow>
                                    ))}
                                </div>
                            </ConfigItemContent>
                        </ConfigItemContainer>
                        <ConfigItemContainer>
                            <ConfigItemHeader>
                                <ConfigItemTitle>{t('config.independence')}</ConfigItemTitle>
                                <ConfigItemDescription>{t('config.independence_desc')}</ConfigItemDescription>
                            </ConfigItemHeader>
                            <ConfigItemContent>
                                <div className="border rounded-md divide-y">
                                    {[
                                        ...GLOBAL_CONFIG.POSITION_CHANNEL_CONFIG_LIST.map((pc) => [pc, t(`config.${pc}`)] as const),
                                        ...GLOBAL_CONFIG.NON_POSITION_CHANNEL_CONFIG_LIST.map((npc) => [npc, t(`constant.draggable_key.${npc}`)] as const),
                                    ].map(([channel, label]) => (
                                        <SettingRow
                                            key={channel}
                                            htmlFor={`resolve_${channel}`}
                                            title={label}
                                            description={t('config.independent_channel_desc', { channel: label })}
                                        >
                                            <Switch
                                                id={`resolve_${channel}`}
                                                checked={resolve[channel] ?? false}
                                                onCheckedChange={(e) => {
                                                    setResolve((r) => ({
                                                        ...r,
                                                        [channel]: e,
                                                    }));
                                                }}
                                            />
                                        </SettingRow>
                                    ))}
                                </div>
                            </ConfigItemContent>
                        </ConfigItemContainer>
                        <ConfigItemContainer>
                            <ConfigItemHeader>
                                <ConfigItemTitle>{t('config.misc')}</ConfigItemTitle>
                            </ConfigItemHeader>
                            <ConfigItemContent>
                                <div className="flex flex-col space-y-6">
                                    {/* Map Configuration Group */}
                                    <div className="space-y-2 border-b pb-4">
                                        <h3 className="text-sm font-medium">{t('config.map_settings')}</h3>
                                        <p className="text-xs text-gray-500 mb-4">
                                            {t('config.map_settings_desc')}
                                        </p>
                                        
                                        <div className="border rounded-md p-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <label className="text-xs font-medium leading-6">{t(`config.customTile`)}</label>
                                                    <p className="text-xs text-gray-500">
                                                        {t('config.customTile_desc')}
                                                    </p>
                                                </div>
                                                <Toggle
                                                    enabled={isNotEmpty(geoMapTileUrl)}
                                                    onChange={(e) => {
                                                        setGeoMapTileUrl(e ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : undefined);
                                                    }}
                                                />
                                            </div>
                                            
                                            {isNotEmpty(geoMapTileUrl) && (
                                                <Input
                                                    type="text"
                                                    value={geoMapTileUrl}
                                                    onChange={(e) => {
                                                        setGeoMapTileUrl(e.target.value);
                                                    }}
                                                    className="mt-4 max-w-md"
                                                    placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Choropleth Settings Group */}
                                    <div className="space-y-2 border-b pb-4">
                                        <h3 className="text-sm font-medium">{t('config.choropleth_settings')}</h3>
                                        <p className="text-xs text-gray-500 mb-4">
                                            {t('config.choropleth_settings_desc')}
                                        </p>
                                        
                                        <div className="border rounded-md">
                                            <div className="p-4">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <label className="text-xs font-medium leading-6">{t('config.include_unmatched')}</label>
                                                        <p className="text-xs text-gray-500">
                                                            {t('config.include_unmatched_desc')}
                                                        </p>
                                                    </div>
                                                    <Toggle
                                                        enabled={scaleIncludeUnmatchedChoropleth}
                                                        onChange={(en) => {
                                                            setScaleIncludeUnmatchedChoropleth(en);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <hr />
                                            
                                            <div className="p-4">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <label className="text-xs font-medium leading-6">{t('config.include_shapes')}</label>
                                                        <p className="text-xs text-gray-500">
                                                            {t('config.include_shapes_desc')}
                                                        </p>
                                                    </div>
                                                    <Toggle
                                                        enabled={showAllGeoshapeInChoropleth}
                                                        onChange={(en) => {
                                                            setShowAllGeoshapeInChoropleth(en);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visualization Settings Group */}
                                    <div className="space-y-2 border-b pb-4">
                                        <h3 className="text-sm font-medium">{t('config.visualization_settings')}</h3>
                                        <p className="text-xs text-gray-500 mb-4">
                                            {t('config.visualization_settings_desc')}
                                        </p>
                                        
                                        <div className="border rounded-md">
                                            <div className='p-4'>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <label className="text-xs font-medium leading-6">{t(`config.zeroScale`)}</label>
                                                        <p className="text-xs text-gray-500">
                                                            {t('config.zeroScale_desc')}
                                                        </p>
                                                    </div>
                                                    <Toggle
                                                        enabled={zeroScale}
                                                        onChange={(en) => {
                                                            setZeroScale(en);
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <hr />
                                            
                                            <div className='p-4'>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <label className="text-xs font-medium leading-6">{t(`config.svg`)}</label>
                                                        <p className="text-xs text-gray-500">
                                                            {t('config.svg_desc')}
                                                        </p>
                                                    </div>
                                                    <Toggle
                                                        enabled={svg}
                                                        onChange={(en) => {
                                                            setSvg(en);
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <hr />
                                            
                                            <div className='p-4'>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <label className="text-xs font-medium leading-6">Renderer</label>
                                                        <p className="text-xs text-gray-500">
                                                            Choose between VegaLite and Observable Plot renderers
                                                        </p>
                                                    </div>
                                                    <Combobox
                                                        className="w-40 h-fit"
                                                        popClassName="w-40"
                                                        selectedKey={renderer}
                                                        onSelect={(value) => setRenderer(value as 'vega-lite' | 'observable-plot')}
                                                        options={GLOBAL_CONFIG.RENDERER_TYPES.map((type) => ({
                                                            value: type,
                                                            label: type === 'vega-lite' ? 'VegaLite' : 'Observable Plot',
                                                        }))}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timezone Settings Group */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium">{t('config.timezone_settings')}</h3>
                                        <p className="text-xs text-gray-500 mb-4">
                                            {t('config.timezone_settings_desc')}
                                        </p>
                                        
                                        <div className="border rounded-md p-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <label className="text-xs font-medium leading-6">{t(`config.customOffset`)}</label>
                                                    <p className="text-xs text-gray-500">
                                                        {t('config.customOffset_desc')}
                                                    </p>
                                                </div>
                                                <Toggle
                                                    enabled={isNotEmpty(displayOffset)}
                                                    onChange={(e) => {
                                                        setDisplayOffsetEdited(true);
                                                        setDisplayOffset(e ? new Date().getTimezoneOffset() : undefined);
                                                    }}
                                                />
                                            </div>
                                            
                                            {isNotEmpty(displayOffset) && (
                                                <Combobox
                                                    className="mt-4 max-w-md"
                                                    popClassName="w-[400px]"
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
                                </div>
                            </ConfigItemContent>
                        </ConfigItemContainer>
                    </div>
                    <DialogFooter className="gap-2 mt-4 px-6">
                        <Button
                            variant="outline"
                            onClick={() => {
                                vizStore.setShowVisualConfigPanel(false);
                            }}
                        >
                            {t('actions.cancel')}
                        </Button>
                        <Button
                            onClick={() => {
                                runInAction(() => {
                                    vizStore.setVisualLayout(
                                        ['format', format],
                                        ['zeroScale', zeroScale],
                                        ['scaleIncludeUnmatchedChoropleth', scaleIncludeUnmatchedChoropleth],
                                        ['showAllGeoshapeInChoropleth', showAllGeoshapeInChoropleth],
                                        ['resolve', resolve],
                                        ['colorPalette', colorPalette],
                                        ['useSvg', svg],
                                        ['renderer', renderer],
                                        [
                                            'scale',
                                            {
                                                opacity: opacityValue.value,
                                                size: sizeValue.value,
                                                column: columnValue.value,
                                                row: rowValue.value,
                                                color: colorValue.value,
                                                theta: thetaValue.value,
                                                radius: radiusValue.value,
                                            },
                                        ],
                                        ...(backgroundEdited
                                            ? [
                                                  [
                                                      'background',
                                                      `rgba(${background.r},${background.g},${background.b},${background.a})`,
                                                  ] as KVTuple<IVisualLayout>,
                                              ]
                                            : []),
                                        ...(primaryColorEdited
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
                                    setVizThemeConfig?.(themeKey);
                                    vizStore.setShowVisualConfigPanel(false);
                                });
                            }}
                        >
                            {t('actions.confirm')}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogNormalContent>
        </Dialog>
    );
};

export default observer(VisualConfigPanel);
