import React from "react";
import { useTranslation } from "react-i18next";
import DimFields from "./dimFields";
import MeaFields from "./meaFields";

const DatasetFields: React.FC = (props) => {
    const { t } = useTranslation("translation", { keyPrefix: "main.tabpanel.DatasetFields" });

    return (
        <div className="p-1 m-0.5 border border-gray-200 dark:border-gray-700 flex flex-col @md/main:flex-1 py-0 px-[0.6em]">
            <h4 className="text-xs mb-2 flex-grow-0 cursor-default select-none mt-2">{t("field_list")}</h4>
            <div className="flex-1 flex @md/main:flex-col max-h-[240px] @lg/main:max-h-[unset] pb-2 @md/main:pb-0 divide-gray-200 dark:divide-gray-700 divide-x @md/main:divide-x-0 @md/main:divide-y">
                <div className="my-1 py-1 @md/main:py-0 w-1/2 @md/main:w-full overflow-y-auto max-h-[380px]">
                    <DimFields />
                </div>
                <div className="my-1 py-1 @md/main:py-0 dark:border-gray-800 w-1/2 @md/main:w-full @md/main:flex-grow-[2] overflow-y-auto">
                    <MeaFields />
                </div>
            </div>
        </div>
    );
};

export default DatasetFields;
