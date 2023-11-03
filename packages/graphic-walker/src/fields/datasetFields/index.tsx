import React from "react";
import { Droppable } from "@kanaries/react-beautiful-dnd";
import { useTranslation } from "react-i18next";
import styled from 'styled-components';
import DimFields from "./dimFields";
import MeaFields from "./meaFields";

const DSContainer = styled.div`
    @media (min-width: 640px) {
        height: 680px;
    }
`

const DatasetFields: React.FC = (props) => {
    const { t } = useTranslation("translation", { keyPrefix: "main.tabpanel.DatasetFields" });

    return (
        <DSContainer className="p-1 m-0.5 border border-gray-200 dark:border-gray-700 flex sm:flex-col" style={{ paddingBlock: 0, paddingInline: '0.6em' }}>
            <h4 className="text-xs mb-2 flex-grow-0 cursor-default select-none mt-2">{t("field_list")}</h4>
            <div className="pd-1 overflow-y-auto" style={{ maxHeight: "380px", minHeight: '100px' }}>
                <Droppable droppableId="dimensions" direction="vertical">
                    {(provided, snapshot) => <DimFields provided={provided} />}
                </Droppable>
            </div>
            <div className="border-t dark:border-gray-700 flex-grow pd-1 overflow-y-auto">
                <Droppable droppableId="measures" direction="vertical">
                    {(provided, snapshot) => <MeaFields provided={provided} />}
                </Droppable>
            </div>
        </DSContainer>
    );
};

export default DatasetFields;
