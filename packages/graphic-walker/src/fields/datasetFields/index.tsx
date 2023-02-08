import React from "react";
import { Droppable } from "@kanaries/react-beautiful-dnd";
import { useTranslation } from "react-i18next";
import styled from 'styled-components';
import { NestContainer } from "../../components/container";
import DimFields from "./dimFields";
import MeaFields from "./meaFields";

const DSContainer = styled(NestContainer)`
    padding-block: 0;
    padding-inline: 0.6em;
`;

const DatasetFields: React.FC = (props) => {
    const { t } = useTranslation("translation", { keyPrefix: "main.tabpanel.DatasetFields" });

    return (
        <DSContainer className="flex-1 border-gray-200 flex md:flex-col">
            <h4 className="text-xs mb-2 flex-grow-0 cursor-default select-none mt-2">{t("field_list")}</h4>
            <div className="pd-1 overflow-y-auto flex flex-col items-stretch" style={{ maxHeight: "min(380px, 60%)", minHeight: 'max(100px, 20%)' }}>
                <Droppable droppableId="dimensions" direction="vertical">
                    {(provided, snapshot) => <DimFields provided={provided} />}
                </Droppable>
            </div>
            <div className="border-t flex-grow pd-1 overflow-y-auto">
                <Droppable droppableId="measures" direction="vertical">
                    {(provided, snapshot) => <MeaFields provided={provided} />}
                </Droppable>
            </div>
        </DSContainer>
    );
};

export default DatasetFields;
