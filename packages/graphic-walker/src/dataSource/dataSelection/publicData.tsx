import React from 'react';
import Table from '../table';
import { DemoDataAssets, PUBLIC_DATA_LIST, IPublicData } from '../config';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../../components/button/primary';
import { CommonStore } from '../../store/commonStore';
import { RadioGroup } from '@headlessui/react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { classNames } from '../../utils';

interface IPublicDataProps {
    commonStore: CommonStore;
}

const PublicData: React.FC<IPublicDataProps> = ({ commonStore }) => {
    const { tmpDataSource } = commonStore;
    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog.public' });

    const handleDataKeyChange = async (data: IPublicData) => {
        try {
            const response = await fetch(DemoDataAssets[data.key]);
            const res = await response.json();
            commonStore.updateTempSTDDS({
                dataSource: res.dataSource,
                rawFields: res.fields.map((f) => ({
                    fid: f.fid,
                    name: f.name,
                    analyticType: f.analyticType,
                    semanticType: f.semanticType,
                    dataType: f.dataType || '?',
                })),
                name: data.title,
            });
        } catch (error) {
            // TODO: add error notification.
            console.error('Error fetching public data:', error);
        }
    };

    return (
        <div>
            <RadioGroup className="h-48 overflow-auto mb-1" by="key" onChange={handleDataKeyChange}>
                {PUBLIC_DATA_LIST.map((data) => (
                    <RadioGroup.Option
                        key={data.key}
                        value={data}
                        className={({ active, checked }) =>
                            classNames(
                                'flex focus:outline-none border rounded items-center justify-between border-gray-300 dark:border-gray-600 p-2 m-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200',
                                active ? 'ring-2 ring-offset-2 ring-indigo-500' : '',
                                checked ? 'bg-gray-50 dark:bg-gray-800 dark:text-gray-200' : ''
                            )
                        }
                    >
                        {({ checked }) => (
                            <>
                                <RadioGroup.Label as="p">{data.title}</RadioGroup.Label>
                                {checked && (
                                    <div className="shrink-0 text-indigo-600">
                                        <CheckCircleIcon className="w-5 h-5" />
                                    </div>
                                )}
                            </>
                        )}
                    </RadioGroup.Option>
                ))}
            </RadioGroup>
            <PrimaryButton
                className="my-1"
                disabled={tmpDataSource.length === 0}
                onClick={() => {
                    commonStore.commitTempDS();
                }}
                text={t('submit')}
            />
            <Table commonStore={commonStore} />
        </div>
    );
};

export default observer(PublicData);
