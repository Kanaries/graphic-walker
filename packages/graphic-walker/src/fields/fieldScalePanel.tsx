import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalStore } from '../store';
import Modal from '../components/modal';
import PrimaryButton from '../components/button/primary';
import DefaultButton from '../components/button/default';
import { useTranslation } from 'react-i18next';
import { runInAction, toJS } from 'mobx';
import { IViewField } from '../interfaces';
import { useRenderer } from '../renderer/hooks';
import { applyViewQuery, transformDataService } from '../services';

const FieldScalePanel: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showFieldScalePanel } = commonStore;
    const { t } = useTranslation();
    const { currentDataset: {dataSource} } = commonStore; 
    const { allFields } = vizStore;
    
    const [domainStart, setDomainStart] = useState<any>('');
    const [domainEnd, setDomainEnd] = useState<any>('');
    const [ VRange, setVRange] = useState<any>({start:'',end:''});
    
    const field = useMemo(() => {
        return toJS(commonStore.domainField as IViewField);
    },[commonStore.domainField])

    useEffect(() => {
        if(field == undefined)return;
        (async () => {
            const data =  await transformDataService(dataSource, allFields);
            const sorted = data.map(d => d[field.fid]).sort((a, b) => a - b);
            const start = sorted[0] ?? '';
            const end = sorted[sorted.length - 1] ?? '';
            setDomainStart(start);
            setDomainEnd(end);
        })()
    },[dataSource,field])

    useEffect(() => {
        setVRange(["",""]);
    },[showFieldScalePanel])

    return (
        <Modal
            show={showFieldScalePanel}
            onClose={() => {
                commonStore.setShowFieldScalePanel(false);
            }}
        >
            <h2 className="text-xl font-semibold mb-4">{t("scale.field_settings")}</h2>
            <p className="text-lg">{t("scale.scale")}</p>
            <div>
                <div className="flex my-2 gap-8">
                    <div className='flex w-1/3'>
                        <label className="block text-m leading-8 mx-2 w-1/3">{t("scale.start_value")}</label>
                            <input
                                type="text"
                                className="block w-2/3 text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                placeholder={domainStart}
                                value = { VRange.start || ''}
                                onChange={(e) => {
                                    setVRange({...VRange,start:e.target.value});
                                }}
                            /> 
                    </div>
                    <div className='flex w-1/3'>
                        <label className="block w-1/3 text-m leading-8 mx-2">{t("scale.end_value")}</label>
                            <input
                                type="text"
                                className="block w-2/3 text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                placeholder={domainEnd}
                                value = { VRange.end || ''}
                                onChange={(e) => {
                                    setVRange({...VRange,end:e.target.value});
                                }}
                            />
                    </div>
                </div>
                <div className="mt-4">
                    <PrimaryButton
                        text={t('actions.confirm')}
                        className="mr-2"
                        onClick={() => {
                            vizStore.createScaleField(commonStore.fieldScaleType,commonStore.domainField as IViewField,VRange.start ?? domainStart,VRange.end ?? domainEnd)
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
