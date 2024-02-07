import React from 'react';
import CSVData from './csvData';
import PublicData from './publicData';
import { useTranslation } from 'react-i18next';
import { CommonStore } from '../../store/commonStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DataSelection: React.FC<{ commonStore: CommonStore }> = (props) => {
    const { commonStore } = props;
    const { t } = useTranslation('translation', { keyPrefix: 'DataSource' });

    return (
        <div className="text-sm">
            <div className="mt-4">
                <Tabs defaultValue="file">
                    <TabsList>
                        <TabsTrigger value="file">{t('dialog.text_file_data')}</TabsTrigger>
                        <TabsTrigger value="public">{t('dialog.public_data')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="file">
                        <CSVData commonStore={commonStore} />
                    </TabsContent>
                    <TabsContent value="public">
                        <PublicData commonStore={commonStore} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default DataSelection;
