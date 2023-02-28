import React, { useRef } from "react";
import { observer } from "mobx-react-lite";
import { CheckCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { Container } from "../components/container";
import Modal from "../components/modal";
import { useGlobalStore } from "../store";
import { download } from "../utils/save";
import GwFile from "./dataSelection/gwFile";
import DataSelection from "./dataSelection";
import DefaultButton from "../components/button/default";
import DropdownSelect from "../components/dropdownSelect";
import PrimaryButton from "../components/button/primary";

interface DSSegmentProps {
    preWorkDone: boolean;
}

const DataSourceSegment: React.FC<DSSegmentProps> = (props) => {
    const { preWorkDone } = props;
    const { commonStore, vizStore } = useGlobalStore();
    const gwFileRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const { currentDataset, datasets, showDSPanel } = commonStore;

    return (
        <Container className="flex items-center">
            <GwFile fileRef={gwFileRef} />
            {!preWorkDone && (
                <div className="grow-0 shrink-0 animate-spin inline-block mr-2 ml-2 w-4 h-4 rounded-full border-t-2 border-l-2 border-blue-500"></div>
            )}
            {/* <label className="text-xs mr-1 whitespace-nowrap self-center h-4">
                {t("DataSource.labels.cur_dataset")}
            </label> */}
            <div className="flex-1 flex flex-col @lg:items-center @lg:flex-row space-y-2 @lg:space-x-2 @lg:space-y-0">
                <DropdownSelect
                    options={datasets.map((d) => ({ label: d.name, value: d.id }))}
                    selectedKey={currentDataset.id}
                    onSelect={(dsKey) => {
                        commonStore.useDS(dsKey);
                    }}
                    placeholder={t("DataSource.labels.cur_dataset")}
                />
                <PrimaryButton
                    text={t("DataSource.buttons.create_dataset")}
                    onClick={() => {
                        commonStore.startDSBuildingTask();
                    }}
                />
                <DefaultButton
                    text={t("DataSource.buttons.export_as_file")}
                    onClick={() => {
                        const res = vizStore.exportAsRaw();
                        download(res, "graphic-walker-notebook.json", "text/plain");
                    }}
                />
                <DefaultButton
                    text={t("DataSource.buttons.import_file")}
                    onClick={() => {
                        if (gwFileRef.current) {
                            gwFileRef.current.click();
                        }
                    }}
                />
                <Modal
                    title={t("DataSource.dialog.create_data_source")}
                    onClose={() => {
                        commonStore.setShowDSPanel(false);
                    }}
                    show={showDSPanel}
                >
                    <DataSelection />
                </Modal>
            </div>
            {/* {showDSPanel && (
                <Modal
                    title={t("DataSource.dialog.create_data_source")}
                    onClose={() => {
                        commonStore.setShowDSPanel(false);
                    }}
                >
                    <DataSelection />
                </Modal>
            )} */}
            {preWorkDone && <CheckCircleIcon className="grow-0 shrink-0 text-green-500 w-5 inline-block ml-2" />}
            {!preWorkDone && <ArrowPathIcon className="grow-0 shrink-0 text-yellow-500 w-5 inline-block ml-2" />}
        </Container>
    );
};

export default observer(DataSourceSegment);
