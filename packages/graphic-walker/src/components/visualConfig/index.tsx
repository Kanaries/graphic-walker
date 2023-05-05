import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { useGlobalStore } from '../../store';
import Modal from '../modal';
import { IVisualConfig } from '../../interfaces';
import PrimaryButton from '../button/primary';
import DefaultButton from '../button/default';
import { useTranslation } from 'react-i18next';

const VisualConfigPanel: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showVisualConfigPanel } = commonStore;
    const { visualConfig } = vizStore;
    const { t } = useTranslation();
    const formatConfigList: (keyof IVisualConfig['format'])[] = [
        'numberFormat',
        'timeFormat',
        'normalizedNumberFormat',
    ];
    const [format, setFormat] = useState<IVisualConfig['format']>({
        numberFormat: visualConfig.format.numberFormat,
        timeFormat: visualConfig.format.timeFormat,
        normalizedNumberFormat: visualConfig.format.normalizedNumberFormat,
    });

    return (
        <Modal
            show={showVisualConfigPanel}
            onClose={() => {
                commonStore.setShowVisualConfigPanel(false);
            }}
        >
            <div>
                <h2 className='text-lg mb-4'>{t('config.format')}</h2>
                <p className='text-xs'>Format guides docs: <a target="_blank" className='underline text-blue-500' href="https://github.com/d3/d3-format#locale_format">read here</a></p>
                {formatConfigList.map((fc) => (
                    <div className="my-2" key={fc}>
                        <label className="block text-xs font-medium leading-6 text-gray-900">{t(`config.${fc}`)}</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
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
                <div className='mt-4'>
                    <PrimaryButton
                        text={t('actions.confirm')}
                        className='mr-2'
                        onClick={() => {
                            vizStore.setVisualConfig('format', format);
                            commonStore.setShowVisualConfigPanel(false);
                        }}
                    />
                    <DefaultButton
                        text={t('actions.cancel')}
                        className='mr-2'
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
