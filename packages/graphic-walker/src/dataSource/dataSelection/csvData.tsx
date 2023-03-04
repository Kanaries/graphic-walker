import React, { useRef, useCallback, useState } from "react";
import { FileReader } from "@kanaries/web-data-loader";
import { IRow } from "../../interfaces";
import Table from "../table";
import styled from "styled-components";
import { useGlobalStore } from "../../store";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import DefaultButton from "../../components/button/default";
import PrimaryButton from "../../components/button/primary";
import DropdownSelect from "../../components/dropdownSelect";
import { charsetOptions } from "./config";

const Container = styled.div`
    overflow-x: auto;
    min-height: 300px;
`;

interface ICSVData {}
const CSVData: React.FC<ICSVData> = (props) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const { commonStore } = useGlobalStore();
    const { tmpDSName, tmpDataSource, tmpDSRawFields } = commonStore;
    const [encoding, setEncoding] = useState<string>("utf-8");

    const onSubmitData = useCallback(() => {
        commonStore.commitTempDS();
    }, []);

    const { t } = useTranslation("translation", { keyPrefix: "DataSource.dialog.file" });
    const fileLoaded = tmpDataSource.length > 0 && tmpDSRawFields.length > 0;

    return (
        <Container>
            {!fileLoaded && (
                <div className="text-center">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                        />
                    </svg>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">{t('choose_file')}</h3>
                    <p className="mt-1 text-sm text-gray-500">{t('get_start_desc')}</p>
                </div>
            )}
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
                            encoding,
                        }).then((data) => {
                            commonStore.updateTempDS(data as IRow[]);
                        });
                    }
                }}
            />
            {!fileLoaded && (
                <div className="my-1 flex justify-center">
                    <DefaultButton
                        className="mr-2"
                        onClick={() => {
                            if (fileRef.current) {
                                fileRef.current.click();
                            }
                        }}
                        text={t("open")}
                    />
                    <div className="inline-block relative">
                        <DropdownSelect
                            buttonClassName="w-36"
                            options={charsetOptions}
                            selectedKey={encoding}
                            onSelect={(k) => {
                                setEncoding(k);
                            }}
                        />
                    </div>
                </div>
            )}
            {fileLoaded && (
                <div className="mb-2 mt-6">
                    <label className="block text-xs text-gray-800 dark:text-gray-200 mb-1 font-bold">
                        {t("dataset_name")}
                    </label>
                    <input
                        type="text"
                        placeholder={t("dataset_name")}
                        value={tmpDSName}
                        onChange={(e) => {
                            commonStore.updateTempName(e.target.value);
                        }}
                        className="text-xs mr-2 p-2 rounded border border-gray-200 dark:border-gray-800 outline-none focus:outline-none focus:border-blue-500 placeholder:italic placeholder:text-slate-400 dark:bg-stone-900"
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
            )}
            {fileLoaded && <Table />}
        </Container>
    );
};

export default observer(CSVData);
