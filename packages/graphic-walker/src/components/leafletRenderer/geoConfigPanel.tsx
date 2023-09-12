import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from '../spinner';
import { useGlobalStore } from '../../store';
import Modal from '../modal';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';
import type { IGeoDataItem, IGeoUrl, Topology } from '../../interfaces';
import DropdownSelect from '../dropdownSelect';
import Dropzone from 'react-dropzone';
import { GeojsonRenderer } from './geojsonRenderer';

const emptyList = [];

const GeoConfigPanel = ({ geoList = emptyList }: { geoList?: IGeoDataItem[] }) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showGeoJSONConfigPanel } = commonStore;
    const { visualConfig } = vizStore;
    const { geoKey, geojson, geoUrl } = visualConfig;
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
                .concat({ label: 'Manual Set', value: '-2' }),
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
            } else {
                vizStore.setGeographicUrl({
                    type: item.type,
                    url: item.url,
                });
            }
            commonStore.setShowGeoJSONConfigPanel(false);
            return;
        }
        try {
            if (!(dataMode === 'GeoJSON' ? geoJSON : topoJSON) && loadedUrl) {
                commonStore.setShowGeoJSONConfigPanel(false);
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
            commonStore.setShowGeoJSONConfigPanel(false);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Modal containerStyle={{ overflow: 'visible' }} show={showGeoJSONConfigPanel} onClose={() => commonStore.setShowGeoJSONConfigPanel(false)}>
            <div>
                <h2 className="text-lg mb-4">{t('geography')}</h2>
                <div>
                    <div className="my-2">
                        <label className="block text-xs font-medium leading-6 text-gray-900">{t('geography_settings.geoKey')}</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                value={featureId}
                                onChange={(e) => setFeatureId(e.target.value)}
                            />
                        </div>
                    </div>
                    {geoList.length > 0 && (
                        <div className="my-2">
                            <label className="block text-xs font-medium leading-6 text-gray-900">GeoData</label>
                            <DropdownSelect options={options} selectedKey={`${selectItem}`} onSelect={setSelectItem} />
                        </div>
                    )}
                    {isCustom && (
                        <div className="my-2">
                            <label className="block text-xs font-medium leading-6 text-gray-900">{t(`geography_settings.${dataMode.toLowerCase()}`)}</label>
                            <div className="mt-1 flex flex-col space-y-2">
                                <div role="radiogroup">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="radio"
                                            name="dataMode"
                                            id="geojson"
                                            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:bg-gray-800 dark:border-gray-600"
                                            checked={dataMode === 'GeoJSON'}
                                            onChange={() => {
                                                setDataMode('GeoJSON');
                                            }}
                                        />
                                        <label htmlFor="geojson" className="text-xs whitespace-nowrap">
                                            {t('geography_settings.geojson')}
                                        </label>
                                        <input
                                            type="radio"
                                            name="dataMode"
                                            id="topojson"
                                            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:bg-gray-800 dark:border-gray-600"
                                            checked={dataMode === 'TopoJSON'}
                                            onChange={() => {
                                                setDataMode('TopoJSON');
                                            }}
                                        />
                                        <label htmlFor="topojson" className="text-xs whitespace-nowrap">
                                            {t('geography_settings.topojson')}
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label className="text-xs whitespace-nowrap capitalize">
                                        {t('geography_settings.href', { format: dataMode.toLowerCase() })}
                                    </label>
                                    <input
                                        type="text"
                                        className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                        value={url}
                                        placeholder={t('geography_settings.hrefPlaceholder', { format: dataMode.toLowerCase() })}
                                        onChange={(e) => {
                                            setUrl(e.target.value);
                                        }}
                                    />
                                    <DefaultButton
                                        text={t('geography_settings.load')}
                                        className="mr-2 flex-shrink-0"
                                        disabled={loading}
                                        icon={loading ? <Spinner className="text-black" /> : undefined}
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
                                    />
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
                                        <div
                                            className={`relative justify-center flex w-full h-80 rounded ring-gray-300 shadow-sm ring-1 ring-inset`}
                                            {...getRootProps()}
                                        >
                                            {isDragActive && (
                                                <div className="absolute items-center justify-center left-0 right-0 top-0 bottom-0 z-20 bg-gray-200 opacity-80" />
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
                                        <input
                                            type="text"
                                            className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
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
                <div className="mt-4">
                    <PrimaryButton text={tGlobal('actions.confirm')} className="mr-2" onClick={handleSubmit} />
                    <DefaultButton
                        text={tGlobal('actions.cancel')}
                        className="mr-2"
                        onClick={() => {
                            commonStore.setShowGeoJSONConfigPanel(false);
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default observer(GeoConfigPanel);
