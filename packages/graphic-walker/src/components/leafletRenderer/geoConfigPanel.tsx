import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { runInAction } from 'mobx';
import { useGlobalStore } from '../../store';
import Modal from '../modal';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';

const GeoConfigPanel: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showGeoJSONConfigPanel } = commonStore;
    const { visualConfig } = vizStore;
    const { geoKey, geojson } = visualConfig;
    const { t: tGlobal } = useTranslation('translation');
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    const [featureId, setFeatureId] = useState('');
    const [url, setUrl] = useState('');
    const [geoJSON, setGeoJSON] = useState('');

    useEffect(() => {
        setFeatureId(geoKey || '');
    }, [geoKey]);

    useEffect(() => {
        setGeoJSON(geojson ? JSON.stringify(geojson, null, 2) : '');
    }, [geojson]);

    return (
        <Modal
            show={showGeoJSONConfigPanel}
            onClose={() => {
                commonStore.setShowGeoJSONConfigPanel(false);
            }}
        >
            <div>
                <h2 className="text-lg mb-4">{t('geojson')}</h2>
                <div>
                    <div className="my-2">
                        <label className="block text-xs font-medium leading-6 text-gray-900">{t('geojson_settings.geoKey')}</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                value={featureId}
                                onChange={(e) => {
                                    setFeatureId(e.target.value);
                                }}
                            />
                        </div>
                    </div>
                    <div className="my-2">
                        <label className="block text-xs font-medium leading-6 text-gray-900">{t('geojson_settings.jsonInput')}</label>
                        <div className="mt-1 flex flex-col space-y-2">
                            <div className="flex items-center space-x-2">
                                <label className="text-xs whitespace-nowrap">
                                    {t('geojson_settings.href')}
                                </label>
                                <input
                                    type="text"
                                    className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    value={url}
                                    placeholder={t('geojson_settings.hrefPlaceholder')}
                                    onChange={(e) => {
                                        setUrl(e.target.value);
                                    }}
                                />
                                <DefaultButton
                                    text={t('geojson_settings.load')}
                                    className="mr-2"
                                    onClick={() => {
                                        if (url) {
                                            fetch(url)
                                                .then((res) => res.json())
                                                .then((json) => {
                                                    setGeoJSON(JSON.stringify(json, null, 2));
                                                });
                                        }
                                    }}
                                />
                            </div>
                            <textarea
                                className="block w-full h-40 rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 resize-none"
                                value={geoJSON}
                                placeholder={t('geojson_settings.jsonInputPlaceholder')}
                                onChange={(e) => {
                                    setGeoJSON(e.target.value);
                                }}
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-4">
                    <PrimaryButton
                        text={tGlobal('actions.confirm')}
                        className="mr-2"
                        onClick={() => {
                            try {
                                const json = JSON.parse(geoJSON);
                                runInAction(() => {
                                    vizStore.setGeoKey(featureId);
                                    vizStore.setGeoJSON(json);
                                    commonStore.setShowGeoJSONConfigPanel(false);
                                });
                            } catch {}
                        }}
                    />
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
