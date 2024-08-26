import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVizStore } from '../../store';
import Spinner from '../spinner';
import type { IGeoDataItem, IGeoUrl, Topology } from '../../interfaces';
import DropdownSelect from '../dropdownSelect';
import Dropzone from 'react-dropzone';
import { GeojsonRenderer } from './geojsonRenderer';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

const emptyList = [];

const GeoConfigPanel = ({ geoList = emptyList }: { geoList?: IGeoDataItem[] }) => {
    const vizStore = useVizStore();
    const { layout, showGeoJSONConfigPanel } = vizStore;
    const { geoKey, geojson, geoUrl } = layout;
    const { t: tGlobal } = useTranslation('translation');
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    const [dataMode, setDataMode] = useState<'GeoJSON' | 'TopoJSON'>(geoUrl?.type ?? 'GeoJSON');
    const [featureId, setFeatureId] = useState('');
    const [url, setUrl] = useState(geoUrl?.url ?? '');
    const [geoJSON, setGeoJSON] = useState('');
    const [topoJSON, setTopoJSON] = useState('');
    const [topoJSONKey, setTopoJSONKey] = useState('');
    const [loadedUrl, setLoadedUrl] = useState<IGeoUrl | undefined>(geoUrl);
    const [loading, setLoading] = useState(false);

    const hasCustomData = url || geojson;

    const [selectItem, setSelectItemR] = useState(() => {
        const i = geoList.findIndex((x) => x.url === geoUrl?.url && x.type === geoUrl?.type);
        if (i === -1 && hasCustomData) {
            return -2;
        }
        return i;
    });

    const options = useMemo(
        () =>
            [{ label: 'Select a Geographic Data', value: '-1' }]
                .concat(
                    geoList.map((x, i) => ({
                        label: x.name,
                        value: `${i}`,
                    }))
                )
                .concat({ label: 'Manual Configuration', value: '-2' }),
        [geoList]
    );
    const setSelectItem = useMemo(() => (a: string) => setSelectItemR(parseInt(a)), []);

    const isCustom = (geoList ?? []).length === 0 || selectItem === -2;

    const defaultTopoJSONKey = useMemo(() => {
        try {
            const value = JSON.parse(topoJSON) as Topology;
            return Object.keys(value.objects)[0] || '';
        } catch (error) {
            return '';
        }
    }, [topoJSON]);

    useEffect(() => {
        setFeatureId(geoKey || '');
    }, [geoKey]);

    useEffect(() => {
        setGeoJSON(geojson ? JSON.stringify(geojson, null, 2) : '');
    }, [geojson]);

    const handleSubmit = () => {
        if (!isCustom) {
            const item = geoList[selectItem];
            if (!item) {
                vizStore.clearGeographicData();
                vizStore.updateGeoKey(featureId);
            } else {
                vizStore.setVisualLayout('geoUrl', {
                    type: item.type,
                    url: item.url,
                });
            }
            vizStore.setShowGeoJSONConfigPanel(false);
            return;
        }
        try {
            if (!(dataMode === 'GeoJSON' ? geoJSON : topoJSON) && loadedUrl) {
                vizStore.setShowGeoJSONConfigPanel(false);
                return;
            }
            const json = JSON.parse(dataMode === 'GeoJSON' ? geoJSON : topoJSON);
            if (dataMode === 'TopoJSON') {
                vizStore.setGeographicData(
                    {
                        type: 'TopoJSON',
                        data: json,
                        objectKey: topoJSONKey || defaultTopoJSONKey,
                    },
                    featureId,
                    loadedUrl?.type === 'TopoJSON' ? loadedUrl : undefined
                );
            } else {
                vizStore.setGeographicData(
                    {
                        type: 'GeoJSON',
                        data: json,
                    },
                    featureId,
                    loadedUrl?.type === 'GeoJSON' ? loadedUrl : undefined
                );
            }
            vizStore.setShowGeoJSONConfigPanel(false);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Dialog
            open={showGeoJSONConfigPanel}
            onOpenChange={() => {
                vizStore.setShowGeoJSONConfigPanel(false);
            }}
        >
            <DialogContent>
                <h2 className="text-lg mb-4">{t('geography')}</h2>
                <div>
                    <div className="my-2">
                        <label className="block text-xs font-medium leading-6">{t('geography_settings.geoKey')}</label>
                        <div className="mt-1">
                            <Input type="text" value={featureId} onChange={(e) => setFeatureId(e.target.value)} />
                        </div>
                    </div>
                    {geoList.length > 0 && (
                        <div className="my-2">
                            <label className="block text-xs font-medium leading-6">GeoData</label>
                            <DropdownSelect options={options} selectedKey={`${selectItem}`} onSelect={setSelectItem} />
                        </div>
                    )}
                    {!isCustom && selectItem >= 0 && (
                        <div className={`relative justify-center flex w-full h-80 rounded border shadow-sm`}>
                            <GeojsonRenderer type={geoList[selectItem].type} url={geoList[selectItem]} />
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
                                    <Button
                                        className="mr-2 flex-shrink-0"
                                        disabled={loading}
                                        onClick={() => {
                                            if (url) {
                                                setLoading(true);
                                                fetch(url)
                                                    .then((res) => res.json())
                                                    .then((json) => {
                                                        (dataMode === 'GeoJSON' ? setGeoJSON : setTopoJSON)(JSON.stringify(json, null, 2));
                                                        setLoadedUrl({ type: dataMode, url });
                                                        setLoading(false);
                                                    })
                                                    .catch(() => {
                                                        setLoading(false);
                                                    });
                                            }
                                        }}
                                    >
                                        {loading && <Spinner />}
                                        {t('geography_settings.load')}
                                    </Button>
                                </div>
                                <Dropzone
                                    onDrop={(acceptedFiles) => {
                                        const f: File = acceptedFiles[0];
                                        if (f) {
                                            const reader = new FileReader();
                                            reader.addEventListener('load', (event) => {
                                                const data = event.target!.result as string;
                                                setLoadedUrl(undefined);
                                                (dataMode === 'GeoJSON' ? setGeoJSON : setTopoJSON)(data);
                                            });
                                            reader.readAsText(f);
                                        }
                                    }}
                                    noClick
                                >
                                    {({ getRootProps, getInputProps, isDragActive, open }) => (
                                        <div className={`relative justify-center flex w-full h-80 rounded border shadow-sm`} {...getRootProps()}>
                                            {isDragActive && (
                                                <div className="absolute items-center justify-center left-0 right-0 top-0 bottom-0 z-20 bg-accent opacity-80" />
                                            )}
                                            <input {...getInputProps()} />
                                            <div onClick={open} className="flex h-full items-center justify-center w-48">
                                                {t('geography_settings.jsonInputPlaceholder', { format: dataMode.toLowerCase() })}
                                            </div>
                                            <GeojsonRenderer data={dataMode === 'GeoJSON' ? geoJSON : topoJSON} type={dataMode} url={loadedUrl} />
                                        </div>
                                    )}
                                </Dropzone>
                                {dataMode === 'TopoJSON' && (
                                    <div className="flex items-center space-x-2">
                                        <label className="text-xs whitespace-nowrap capitalize">{t('geography_settings.objectKey')}</label>
                                        <Input
                                            type="text"
                                            value={topoJSONKey}
                                            placeholder={defaultTopoJSONKey}
                                            onChange={(e) => {
                                                setTopoJSONKey(e.target.value);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button children={tGlobal('actions.confirm')} onClick={handleSubmit} />
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
