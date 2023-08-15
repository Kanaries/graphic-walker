import React from 'react';
import Table from '../table';
import { DemoDataAssets, PUBLIC_DATA_LIST } from '../config'
import { useGlobalStore } from '../../store';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../../components/button/primary';


interface IPublicDataProps {

}

const PublicData: React.FC<IPublicDataProps> = props => {
    const commonStore= useGlobalStore();
    const { tmpDataSource } = commonStore;
    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog.public' });

    return <div>
        <div className="h-48 overflow-auto mb-1">
            {
                PUBLIC_DATA_LIST.map(data => <div key={data.key}
                    onClick={() => {
                        fetch(DemoDataAssets[data.key]).then(res => res.json())
                        .then(res => {
                            commonStore.updateTempSTDDS({
                                dataSource: res.dataSource,
                                rawFields: res.fields.map(f => ({
                                    fid: f.fid,
                                    name: f.name,
                                    analyticType: f.analyticType,
                                    semanticType: f.semanticType,
                                    dataType: f.dataType || '?'
                                })),
                                name: data.title
                            })
                        })
                    }}
                    className="border rounded border-gray-300 dark:border-gray-600 p-2 m-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200"
                    >
                <div>{data.title}</div>
                {/* <p>{data.title}</p> */}
            </div>)
            }
        </div>
        <PrimaryButton
            className='my-1'
            disabled={tmpDataSource.length === 0}
            onClick={() => { commonStore.commitTempDS() }}
            text={t('submit')}
        />
        <Table />
    </div>
}

export default observer(PublicData);
