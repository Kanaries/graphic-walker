import React, { useRef, useCallback } from "react";
import { FileReader } from "@kanaries/web-data-loader";
import { IRow } from "../../interfaces";
import Table from "../table";
import styled from "styled-components";
import { useGlobalStore } from "../../store";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import DefaultButton from "../../components/button/default";
import PrimaryButton from "../../components/button/primary";

const Container = styled.div`
    overflow-x: auto;
`;

interface ICSVData {}
const CSVData: React.FC<ICSVData> = (props) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const { commonStore } = useGlobalStore();
    const { tmpDSName, tmpDataSource } = commonStore;

    const onSubmitData = useCallback(() => {
        commonStore.commitTempDS();
    }, []);

    const { t } = useTranslation("translation", { keyPrefix: "DataSource.dialog.file" });

    return (
        <Container>
            <input
                style={{ display: "none" }}
                type="file"
                ref={fileRef}
                onChange={(e) => {
                    const files = e.target.files;
                    if (files !== null) {
                        const file = files[0];
                        FileReader.csvReader({
                            file,
                            config: { type: "reservoirSampling", size: Infinity },
                            onLoading: () => {},
                        }).then((data) => {
                            commonStore.updateTempDS(data as IRow[]);
                        });
                    }
                }}
            />
            <div className="my-1">
                <DefaultButton
                    className="mr-2"
                    onClick={() => {
                        if (fileRef.current) {
                            fileRef.current.click();
                        }
                    }}
                    text={t("open")}
                />
                <PrimaryButton
                    className="mr-2"
                    text={t("submit")}
                    disabled={tmpDataSource.length === 0}
                    onClick={() => {
                        onSubmitData();
                    }}
                />
            </div>
            <div className="my-2">
                <label className="block text-xs text-gray-800 dark:text-gray-200 mb-1 font-bold">{t("dataset_name")}</label>
                <input
                    type="text"
                    placeholder={t("dataset_name")}
                    value={tmpDSName}
                    onChange={(e) => {
                        commonStore.updateTempName(e.target.value);
                    }}
                    className="text-xs p-2 rounded border border-gray-200 dark:border-gray-800 outline-none focus:outline-none focus:border-blue-500 placeholder:italic placeholder:text-slate-400 dark:bg-stone-900"
                />
            </div>
            <Table />
        </Container>
    );
};

export default observer(CSVData);
