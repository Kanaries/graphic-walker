import { observer } from 'mobx-react-lite';
import React, { useEffect, useRef, useState } from 'react';
import { useGlobalStore } from '../store';
import Modal from '../components/modal';
import PrimaryButton from '../components/button/primary';
import DefaultButton from '../components/button/default';
import { useTranslation } from 'react-i18next';
import { runInAction, toJS } from 'mobx';

const FieldScalePanel: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showFieldScalePanel } = commonStore;
    const { visualConfig } = vizStore;
    const [domainStart, setDomainStart] = useState<any>(undefined);
    const [domainEnd, setDomainEnd] = useState<any>(undefined);
    const { t } = useTranslation();
    return (
        <Modal
            show={showFieldScalePanel}
            onClose={() => {
                commonStore.setShowFieldScalePanel(false);
            }}
        >
            <h2 className="text-xl font-semibold mb-4">Field Setting</h2>

            <p className="text-lg">Domain</p>
            <div>
                <div className="flex my-2 gap-8">
                    <div className='flex w-1/3'>
                        <label className="block text-m leading-8 mx-2">Start</label>
                 
                            <input
                                type="text"
                                className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                value={domainStart ?? ''}
                                onChange={(e) => {
                                    setDomainStart(e.target.value);
                                }}
                            />
                       
                    </div>

                    <div className='flex w-1/3'>
                        <label className="block text-m leading-8 mx-2">End</label>
                    
                            <input
                                type="text"
                                className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                value={domainEnd ?? ''}
                                onChange={(e) => {
                                    setDomainEnd(e.target.value);
                                }}
                            />
                    </div>
                </div>

                <div className="mt-4">
                    <PrimaryButton
                        text={t('actions.confirm')}
                        className="mr-2"
                        onClick={() => {
                            const field = commonStore.tmpDSRawFields[0];
                            vizStore.createScaleField(commonStore.fieldScaleType,commonStore.fieldScaleIndex,domainStart,domainEnd)
                            commonStore.setShowFieldScalePanel(false);
                        }}
                    />
                    <DefaultButton
                        text={t('actions.cancel')}
                        className="mr-2"
                        onClick={() => {
                            commonStore.setShowFieldScalePanel(false);
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
};
export default observer(FieldScalePanel);
