import React, { useRef } from "react";
import { observer } from "mobx-react-lite";
import { LightBulbIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import type { IReactVegaHandler } from "../../../vis/react-vega";
import VisualSettings from "../../../visualSettings";
import { NestContainer } from "../../container";
import ClickMenu from "../../clickMenu";
import InsightBoard from "../../../insightBoard/index";
import PosFields from "../../../fields/posFields";
import AestheticFields from "../../../fields/aestheticFields";
import DatasetFields from "../../../fields/datasetFields/index";
import ReactiveRenderer from "../../../renderer/index";
import { useGlobalStore } from "../../../store";
import FilterField from "../../../fields/filterField";

export interface ChartEditorProps {}

const ChartEditor: React.FC<ChartEditorProps> = (props) => {
    const { commonStore } = useGlobalStore();
    const { datasets, vizEmbededMenu } = commonStore;

    const { t } = useTranslation();

    const rendererRef = useRef<IReactVegaHandler>(null);

    return (
        <div className="w-full h-full flex flex-col">
            <VisualSettings rendererHandler={rendererRef} />
            <div className="flex-1 p-1.5 md:grid md:grid-cols-12 xl:grid-cols-6 flex flex-row items-stretch">
                <div className="md:col-span-3 xl:col-span-1 flex flex-col">
                    <DatasetFields />
                </div>
                <div className="md:col-span-2 xl:col-span-1">
                    <FilterField />
                    <AestheticFields />
                </div>
                <div className="md:col-span-7 xl:col-span-4 flex flex-col">
                    <div className="flex-grow-0 flex-shrink-0">
                        <PosFields />
                    </div>
                    <NestContainer
                        className="flex-1"
                        style={{ overflow: "auto" }}
                        onMouseLeave={() => {
                            vizEmbededMenu.show && commonStore.closeEmbededMenu();
                        }}
                    >
                        {datasets.length > 0 && <ReactiveRenderer ref={rendererRef} />}
                        <InsightBoard />
                        {vizEmbededMenu.show && (
                            <ClickMenu x={vizEmbededMenu.position[0]} y={vizEmbededMenu.position[1]}>
                                <div
                                    className="flex items-center whitespace-nowrap py-1 px-4 hover:bg-gray-100"
                                    onClick={() => {
                                        commonStore.closeEmbededMenu();
                                        commonStore.setShowInsightBoard(true);
                                    }}
                                >
                                    <span className="flex-1 pr-2">{t("App.labels.data_interpretation")}</span>
                                    <LightBulbIcon className="ml-1 w-3 flex-grow-0 flex-shrink-0" />
                                </div>
                            </ClickMenu>
                        )}
                    </NestContainer>
                </div>
            </div>
        </div>
    );
};

export default observer(ChartEditor);
