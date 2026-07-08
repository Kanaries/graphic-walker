import React from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import Table from '../table';
import { CommonStore } from '../../store/commonStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface IDataPreviewProps {
    commonStore: CommonStore;
}

const DataPreview: React.FC<IDataPreviewProps> = ({ commonStore }) => {
    const { tmpDSName, tmpDataSource, tmpDSRawFields } = commonStore;
    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog.preview' });

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        commonStore.initTempDS();
                    }}
                >
                    <ChevronLeftIcon className="mr-1 h-4 w-4" />
                    {t('back')}
                </Button>
                <Input
                    type="text"
                    aria-label={t('dataset_name')}
                    placeholder={t('dataset_name')}
                    value={tmpDSName}
                    onChange={(e) => {
                        commonStore.updateTempName(e.target.value);
                    }}
                    className="w-48"
                />
                <span className="text-xs text-muted-foreground">
                    {t('meta', { rows: tmpDataSource.length.toLocaleString(), cols: tmpDSRawFields.length })}
                </span>
                <Button
                    className="ml-auto"
                    disabled={tmpDSName.trim().length === 0}
                    onClick={() => {
                        commonStore.commitTempDS();
                    }}
                >
                    {t('use_data')}
                </Button>
            </div>
            <Table commonStore={commonStore} />
            <p className="text-xs text-muted-foreground">{t('tip')}</p>
        </div>
    );
};

export default observer(DataPreview);
