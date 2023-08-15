import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useVizStore } from '../../store';
import { NonPositionChannelConfigList, PositionChannelConfigList } from '../../config';

import Modal from '../modal';
import { IVisualConfig } from '../../interfaces';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';
import { useTranslation } from 'react-i18next';
import Toggle from '../toggle';
import { runInAction, toJS } from 'mobx';

const VisualConfigPanel: React.FC = (props) => {
    const vizStore = useVizStore();
    const { showVisualConfigPanel } = vizStore;
    const { config, layout } = vizStore;
    const {
        coordSystem,
        geoms: [markType],
    } = config;
    const isChoropleth = coordSystem === 'geographic' && markType === 'choropleth';
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
    const [scaleIncludeUnmatchedChoropleth, setScaleIncludeUnmatchedChoropleth] = useState<boolean>(layout.scaleIncludeUnmatchedChoropleth ?? false);
    const [background, setBackground] = useState<string | undefined>(layout.background);

    useEffect(() => {
        setZeroScale(layout.zeroScale);
        setBackground(layout.background);
        setResolve(layout.resolve);
        setScaleIncludeUnmatchedChoropleth(layout.scaleIncludeUnmatchedChoropleth ?? false);
        setFormat({
            numberFormat: layout.format.numberFormat,
            timeFormat: layout.format.timeFormat,
            normalizedNumberFormat: layout.format.normalizedNumberFormat,
        });
    }, [showVisualConfigPanel]);

    return (
        <Modal
            show={showVisualConfigPanel}
            onClose={() => {
                vizStore.setShowVisualConfigPanel(false);
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
                <h2 className="text-lg">{t('config.background')}</h2>
                <div className="my-2">
                    <label className="block text-xs font-medium leading-6">{t(`config.color`)}</label>
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
                <h2 className="text-lg">{t('config.independence')}</h2>
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
                <h2 className="text-lg">{t('config.zeroScale')}</h2>
                <div className="my-2">
                    <Toggle
                        label={t(`config.zeroScale`)}
                        enabled={zeroScale}
                        onChange={(en) => {
                            setZeroScale(en);
                        }}
                    />
                </div>
                {isChoropleth && (
                    <div className="my-2">
                        <Toggle
                            label="include unmatched choropleth in scale"
                            enabled={scaleIncludeUnmatchedChoropleth}
                            onChange={(en) => {
                                setScaleIncludeUnmatchedChoropleth(en);
                            }}
                        />
                    </div>
                )}
                <div className="mt-4">
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
                                    ['resolve', resolve]
                                );
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
