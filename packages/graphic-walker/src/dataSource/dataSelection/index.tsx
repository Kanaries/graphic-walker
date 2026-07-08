import React from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import FileUpload from './fileUpload';
import DemoData from './demoData';
import DataPreview from './preview';
import { CommonStore } from '../../store/commonStore';

const DataSelection: React.FC<{ commonStore: CommonStore }> = ({ commonStore }) => {
    const { tmpDataSource, tmpDSRawFields } = commonStore;
    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog' });
    const dataLoaded = tmpDataSource.length > 0 && tmpDSRawFields.length > 0;

    return (
        <div className="mt-4 text-sm">
            {dataLoaded ? (
                <DataPreview commonStore={commonStore} />
            ) : (
                <div className="flex flex-col gap-4">
                    <FileUpload commonStore={commonStore} />
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-background px-3 text-xs uppercase tracking-wide text-muted-foreground">{t('or_demo')}</span>
                        </div>
                    </div>
                    <DemoData commonStore={commonStore} />
                </div>
            )}
        </div>
    );
};

export default observer(DataSelection);
