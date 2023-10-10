import React, { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import Modal from '../components/modal';
import { useGlobalStore } from '../store';
import { download } from '../utils/save';
import GwFile from './dataSelection/gwFile';
import DataSelection from './dataSelection';
import DefaultButton from '../components/button/default';
import DropdownSelect from '../components/dropdownSelect';
import PrimaryButton from '../components/button/primary';

interface DSSegmentProps {}

const DataSourceSegment: React.FC<DSSegmentProps> = (props) => {
    const commonStore = useGlobalStore();
    const gwFileRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const { dataStore, showDSPanel } = commonStore;
    const { currentDataset, dataSources } = dataStore;
    return (
        <div className="flex items-center m-4 p-4 border border-gray-200 dark:border-gray-700">
            <GwFile fileRef={gwFileRef} />
            {/* <label className="text-xs mr-1 whitespace-nowrap self-center h-4">
                {t("DataSource.labels.cur_dataset")}
            </label> */}
            <div className="mr-2">
                <DropdownSelect
                    options={dataSources.map((d) => ({ label: d.name, value: d.id }))}
                    selectedKey={currentDataset.id}
                    onSelect={(dsKey) => {
                        dataStore.useDS(dsKey);
                    }}
                    placeholder={t('DataSource.labels.cur_dataset')}
                />
            </div>

            <PrimaryButton
                className="mr-2"
                text={t('DataSource.buttons.create_dataset')}
                onClick={() => {
                    commonStore.startDSBuildingTask();
                }}
            />
            <DefaultButton
                className="mr-2"
                text={t('DataSource.buttons.export_as_file')}
                onClick={() => {
                    const res = JSON.stringify(dataStore.exportData());
                    download(res, 'graphic-walker-notebook.json', 'text/plain');
                }}
            />
            <DefaultButton
                className="mr-2"
                text={t('DataSource.buttons.import_file')}
                onClick={() => {
                    if (gwFileRef.current) {
                        gwFileRef.current.click();
                    }
                }}
            />
            <Modal
                title={t('DataSource.dialog.create_data_source')}
                onClose={() => {
                    commonStore.setShowDSPanel(false);
                }}
                show={showDSPanel}
            >
                <DataSelection />
            </Modal>
        </div>
    );
};

export default observer(DataSourceSegment);
