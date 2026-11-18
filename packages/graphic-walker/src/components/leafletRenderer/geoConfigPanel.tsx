import { observer } from 'mobx-react-lite';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVizStore } from '../../store';
import Spinner from '../spinner';
import type { IGeoDataItem, IGeoUrl, Topology } from '../../interfaces';
import DropdownSelect from '../dropdownSelect';
import Dropzone from 'react-dropzone';
import { GeojsonRenderer } from './geojsonRenderer';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useGeoData } from '../../hooks/service';
import { fetchGeoJson, geoDataErrorOf, isTopology, parseGeoText, toFeatureCollection, topologyObjectKeys, type GeoDataErrorCode } from '../../lib/geo/parse';
import { listFeatureKeys, suggestFeatureKey } from '../../lib/geo/matching';
import { useGeoErrorText } from './geoNotice';
import { themeContext, vegaThemeContext } from '../../store/theme';
import { getTheme } from '../../utils/useTheme';

const emptyList = [];

/** A file or URL the user has loaded in this dialog and not yet confirmed. */
interface ILoadedSource {
    json: unknown;
    /** Where it came from, when it was loaded by URL. */
    url?: string;
}

const GeoConfigPanel = ({ geoList = emptyList }: { geoList?: IGeoDataItem[] }) => {
    const vizStore = useVizStore();
    const { layout, showGeoJSONConfigPanel } = vizStore;
    const { geoKey, geojson, geoUrl } = layout;
    const { t: tGlobal } = useTranslation('translation');
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });
    const errorText = useGeoErrorText();
    // The preview draws the basemap the chart draws: the chart's own setting, else the host theme's.
    const { vizThemeConfig } = useContext(vegaThemeContext);
    const mediaTheme = useContext(themeContext);
    const tileUrl = layout.geoMapTileUrl ?? getTheme({ vizThemeConfig, mediaTheme })?.leafletGeoTileUrl;

    const [dataMode, setDataMode] = useState<'GeoJSON' | 'TopoJSON'>(geoUrl?.type ?? 'GeoJSON');
    const [featureId, setFeatureId] = useState('');
    const [url, setUrl] = useState(geoUrl?.url ?? '');
    const [source, setSource] = useState<ILoadedSource>();
    const [objectKey, setObjectKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<{ code: GeoDataErrorCode | 'empty'; detail: string }>();

    const hasCustomData = url || geojson;

    const [selectItem, setSelectItemR] = useState(() => {
        // Two presets can draw different objects of one TopoJSON file, so the object is part of which preset it is.
        const i = geoList.findIndex((x) => x.url === geoUrl?.url && x.type === geoUrl?.type && (x.objectKey ?? '') === (geoUrl?.objectKey ?? ''));
        if (i === -1 && hasCustomData) {
            return -2;
        }
        return i;
    });

    const options = useMemo(
        () =>
            [{ label: t('geography_settings.selectData'), value: '-1' }]
                .concat(
                    geoList.map((x, i) => ({
                        label: x.name,
                        value: `${i}`,
                    }))
                )
                .concat({ label: t('geography_settings.manual'), value: '-2' }),
        [geoList, t]
    );
    const setSelectItem = useMemo(
        () => (a: string) => {
            setSelectItemR(parseInt(a));
            setError(undefined);
        },
        []
    );

    const isCustom = (geoList ?? []).length === 0 || selectItem === -2;

    // The shapes the dialog is looking at: a preset, a file loaded here, or what the chart already has.
    const listItem = !isCustom && selectItem >= 0 ? geoList[selectItem] : undefined;
    const savedUrl = isCustom && !source && !geojson ? geoUrl : undefined;
    const remoteUrl = useMemo<IGeoUrl | undefined>(
        () => (listItem ? { type: listItem.type, url: listItem.url, ...(listItem.objectKey ? { objectKey: listItem.objectKey } : {}) } : savedUrl),
        [listItem, savedUrl]
    );
    const remote = useGeoData(undefined, remoteUrl);
    const loaded = useMemo(() => {
        if (!source) return undefined;
        try {
            return toFeatureCollection(source.json, objectKey || undefined);
        } catch {
            return undefined;
        }
    }, [source, objectKey]);
    const features = isCustom ? loaded ?? (source ? undefined : geojson) ?? remote.data : remote.data;

    const topologyObjects = useMemo(() => (source ? topologyObjectKeys(source.json) : []), [source]);
    const featureKeys = useMemo(() => (features ? listFeatureKeys(features.features) : []), [features]);
    const featureKeyOptions = useMemo(
        () =>
            featureKeys.map(({ key, samples }) => ({
                value: key,
                label: (
                    <span>
                        {key}
                        <span className="ml-2 text-muted-foreground">{t('geography_settings.geoKeySample', { samples: samples.join(', ') })}</span>
                    </span>
                ),
            })),
        [featureKeys, t]
    );

    useEffect(() => {
        setFeatureId(geoKey || '');
    }, [geoKey]);

    useEffect(() => {
        // A key the file does not have would match nothing, so move to one it has.
        if (featureKeys.length > 0) setFeatureId((current) => suggestFeatureKey(featureKeys, current));
    }, [featureKeys]);

    // Confirming saves the key on show, so the key has to belong to the shapes on show.
    // - While a preset, a saved address or a typed address is on its way, the key still belongs to
    //   the shapes before it, and for a typed address the new shapes would not be saved at all.
    // - Shapes without any property cannot be matched to data, so there is no key to save.
    // - A preset that failed to load has no shapes to check the key against.
    const busy = loading || remote.loading;
    const noKeys = Boolean(features) && featureKeys.length === 0;
    const canConfirm = !busy && (features ? featureKeys.some((k) => k.key === featureId) : !listItem);

    /** Takes over a parsed file once it is known to hold shapes. Throws a GeoDataError when it does not. */
    const acceptSource = (json: unknown, fromUrl?: string) => {
        toFeatureCollection(json);
        setSource({ json, url: fromUrl });
        setObjectKey('');
        setDataMode(isTopology(json) ? 'TopoJSON' : 'GeoJSON');
        setError(undefined);
    };

    const loadUrl = () => {
        if (!url) return;
        setLoading(true);
        setError(undefined);
        fetchGeoJson(url)
            .then((json) => acceptSource(json, url))
            .catch((e) => setError(geoDataErrorOf(e)))
            .finally(() => setLoading(false));
    };

    const loadFile = (file: File) => {
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            try {
                acceptSource(parseGeoText(event.target!.result as string));
            } catch (e) {
                setError(geoDataErrorOf(e));
            }
        });
        reader.addEventListener('error', () => setError({ code: 'network', detail: '' }));
        reader.readAsText(file);
    };

    const handleSubmit = () => {
        if (!isCustom) {
            if (!listItem) {
                vizStore.clearGeographicData();
                vizStore.updateGeoKey(featureId);
            } else {
                vizStore.setGeoUrl(remoteUrl!, featureId);
            }
            vizStore.setShowGeoJSONConfigPanel(false);
            return;
        }
        if (source) {
            if (!loaded) {
                setError({ code: 'format', detail: '' });
                return;
            }
            const topology = isTopology(source.json);
            const pickedObject = objectKey || topologyObjects[0];
            const from: IGeoUrl | undefined = source.url
                ? { type: topology ? 'TopoJSON' : 'GeoJSON', url: source.url, ...(topology && objectKey ? { objectKey } : {}) }
                : undefined;
            vizStore.setGeographicData(
                topology ? { type: 'TopoJSON', data: source.json as Topology, objectKey: pickedObject } : { type: 'GeoJSON', data: loaded },
                featureId,
                from
            );
        } else if (geojson) {
            // The shapes are the ones the chart already has. Only the match key can have changed.
            vizStore.updateGeoKey(featureId);
        } else if (geoUrl) {
            vizStore.setGeoUrl(geoUrl, featureId);
        } else {
            setError({ code: 'empty', detail: '' });
            return;
        }
        vizStore.setShowGeoJSONConfigPanel(false);
    };

    const shownError = error ?? (remote.error ? geoDataErrorOf(remote.error) : undefined);

    return (
        <Dialog
            open={showGeoJSONConfigPanel}
            onOpenChange={() => {
                vizStore.setShowGeoJSONConfigPanel(false);
            }}
        >
            <DialogContent aria-describedby={undefined}>
                <DialogTitle className="text-lg mb-4 font-normal leading-normal tracking-normal">{t('geography')}</DialogTitle>
                <div>
                    <div className="my-2">
                        <label className="block text-xs font-medium leading-6">{t('geography_settings.geoKey')}</label>
                        <div className="mt-1" data-testid="geo-config-key">
                            <DropdownSelect
                                options={featureKeyOptions}
                                selectedKey={featureKeys.length > 0 ? featureId : ''}
                                onSelect={setFeatureId}
                                disable={featureKeys.length === 0}
                                placeholder={t('geography_settings.geoKeyEmpty')}
                            />
                        </div>
                    </div>
                    {geoList.length > 0 && (
                        <div className="my-2" data-testid="geo-config-preset">
                            <label className="block text-xs font-medium leading-6">{t('geography_settings.geoData')}</label>
                            <DropdownSelect options={options} selectedKey={`${selectItem}`} onSelect={setSelectItem} />
                        </div>
                    )}
                    {listItem && (
                        <div className={`relative justify-center flex w-full h-80 rounded border shadow-sm`}>
                            <GeojsonRenderer data={features} loading={remote.loading} tileUrl={tileUrl} />
                        </div>
                    )}
                    {isCustom && (
                        <div className="my-2">
                            <label className="block text-xs font-medium leading-6">{t(`geography_settings.${dataMode.toLowerCase()}`)}</label>
                            <div className="mt-1 flex flex-col space-y-2">
                                <div role="radiogroup">
                                    <RadioGroup
                                        value={dataMode}
                                        onValueChange={(v) => setDataMode(v as 'GeoJSON' | 'TopoJSON')}
                                        className="flex items-center space-x-2"
                                    >
                                        <RadioGroupItem value="GeoJSON" id="geojson" />
                                        <label htmlFor="geojson" className="text-xs whitespace-nowrap">
                                            {t('geography_settings.geojson')}
                                        </label>
                                        <RadioGroupItem value="TopoJSON" id="topojson" />
                                        <label htmlFor="topojson" className="text-xs whitespace-nowrap">
                                            {t('geography_settings.topojson')}
                                        </label>
                                    </RadioGroup>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label className="text-xs whitespace-nowrap capitalize">
                                        {t('geography_settings.href', { format: dataMode.toLowerCase() })}
                                    </label>
                                    <Input
                                        type="text"
                                        value={url}
                                        placeholder={t('geography_settings.hrefPlaceholder', { format: dataMode.toLowerCase() })}
                                        onChange={(e) => {
                                            setUrl(e.target.value);
                                        }}
                                    />
                                    <Button className="mr-2 flex-shrink-0" disabled={loading} onClick={loadUrl}>
                                        {loading && <Spinner />}
                                        {t('geography_settings.load')}
                                    </Button>
                                </div>
                                <Dropzone
                                    onDrop={(acceptedFiles) => {
                                        const f: File = acceptedFiles[0];
                                        if (f) loadFile(f);
                                    }}
                                    noClick
                                >
                                    {({ getRootProps, getInputProps, isDragActive, open }) => (
                                        <div className={`relative justify-center flex w-full h-80 rounded border shadow-sm`} {...getRootProps()}>
                                            {isDragActive && (
                                                <div className="absolute items-center justify-center left-0 right-0 top-0 bottom-0 z-20 bg-accent opacity-80" />
                                            )}
                                            <input {...getInputProps()} data-testid="geo-config-file" />
                                            <div onClick={open} className="flex h-full items-center justify-center w-48">
                                                {t('geography_settings.jsonInputPlaceholder', { format: dataMode.toLowerCase() })}
                                            </div>
                                            <GeojsonRenderer data={features} loading={remote.loading} tileUrl={tileUrl} />
                                        </div>
                                    )}
                                </Dropzone>
                                {topologyObjects.length > 1 && (
                                    <div className="flex items-center space-x-2" data-testid="geo-config-object">
                                        <label className="text-xs whitespace-nowrap capitalize">{t('geography_settings.objectKey')}</label>
                                        <DropdownSelect
                                            options={topologyObjects.map((name) => ({ label: name, value: name }))}
                                            selectedKey={objectKey || topologyObjects[0]}
                                            onSelect={setObjectKey}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {shownError && (
                        <p role="alert" className="my-2 text-xs text-destructive" data-testid="geo-config-error" data-code={shownError.code}>
                            {shownError.code === 'empty' ? t('geography_settings.noSource') : errorText({ code: shownError.code, detail: shownError.detail })}
                        </p>
                    )}
                    {!shownError && !busy && noKeys && (
                        <p role="alert" className="my-2 text-xs text-destructive" data-testid="geo-config-error" data-code="no_keys">
                            {t('geography_settings.noKeys')}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button children={tGlobal('actions.confirm')} onClick={handleSubmit} disabled={!canConfirm} data-testid="geo-config-confirm" />
                    <Button
                        children={tGlobal('actions.cancel')}
                        variant="outline"
                        onClick={() => {
                            vizStore.setShowGeoJSONConfigPanel(false);
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default observer(GeoConfigPanel);
