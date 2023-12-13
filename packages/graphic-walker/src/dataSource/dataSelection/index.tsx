import React, { useMemo } from 'react';
import { useState } from 'react';
import CSVData from './csvData';
import PublicData from './publicData';
import { useTranslation } from 'react-i18next';
import PureTabs from '../../components/tabs/defaultTab';
import { CommonStore } from '../../store/commonStore';

const DataSelection: React.FC<{ commonStore: CommonStore }> = (props) => {
    const { commonStore } = props;
    const [sourceType, setSourceType] = useState<'file' | 'public'>('file');
    const { t } = useTranslation('translation', { keyPrefix: 'DataSource' });

    const sourceOptions = useMemo(() => {
        return [
            { label: t('dialog.text_file_data'), key: 'file' },
            { label: t('dialog.public_data'), key: 'public' },
        ];
    }, []);

    return (
        <div className="text-sm">
            <div className="px-2">
                <PureTabs
                    selectedKey={sourceType}
                    tabs={sourceOptions}
                    onSelected={(sk) => {
                        setSourceType(sk as 'public' | 'file');
                    }}
                />
                {sourceType === 'file' && <CSVData commonStore={commonStore} />}
                {sourceType === 'public' && <PublicData commonStore={commonStore} />}
            </div>
        </div>
    );
};

export default DataSelection;
