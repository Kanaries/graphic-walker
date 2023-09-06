import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useGlobalStore } from '../../store';
import { NonPositionChannelConfigList, PositionChannelConfigList } from '../../config';

import Modal from '../modal';
import { IVisualConfig } from '../../interfaces';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';
import { useTranslation } from 'react-i18next';
import Toggle from '../toggle';
import { runInAction, toJS } from 'mobx';

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
    const [scaleIncludeUnmatchedChoropleth, setScaleIncludeUnmatchedChoropleth] = useState<boolean>(visualConfig.scaleIncludeUnmatchedChoropleth ?? false);
    const [background, setBackground] = useState<string | undefined>(visualConfig.background);

    useEffect(() => {
        setZeroScale(visualConfig.zeroScale);
        setBackground(visualConfig.background);
        setResolve(toJS(visualConfig.resolve));
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
            <div>
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
                <hr className='my-4' />
                <div className="my-2">
                    <label className="block text-xs font-medium leading-6">{t('config.background')} {t(`config.color`)}</label>
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
                        {PositionChannelConfigList.map((pc) => (
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
                        {NonPositionChannelConfigList.map((npc) => (
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
