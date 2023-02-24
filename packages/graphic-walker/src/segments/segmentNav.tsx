import React, { Fragment, useCallback } from "react";
import { observer } from "mobx-react-lite";
import DefaultTab, { ITabOption } from "../components/tabs/defaultTab";
import { useGlobalStore } from "../store";
import { ChartBarIcon, ChartPieIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import { ISegmentKey } from "../interfaces";
import { useTranslation } from "react-i18next";


const ADD_KEY = '_add';

const SegmentNav: React.FC = (props) => {
    const { vizStore, commonStore } = useGlobalStore();
    const { visIndex, visList } = vizStore;
    const { currentDataset, segmentKey } = commonStore;
    const { t } = useTranslation();

    const tabs: ITabOption[] = [
        {
            key: ISegmentKey.data,
            label: <div className="flex">
                <CircleStackIcon className="w-4 mr-2" /> {t('App.segments.data')}
            </div>
        },
        {
            key: ISegmentKey.vis,
            label: <div className="flex">
                <ChartPieIcon className="w-4 mr-2" /> {t('App.segments.vis')}
            </div>
        }
    ]

    const visSelectionHandler = useCallback((tabKey: string, tabIndex: number) => {
        if (tabKey === ADD_KEY) {
            vizStore.addVisualization();
            vizStore.initMetaState(currentDataset)
        } else {
            vizStore.selectVisualization(tabIndex);
        }
    }, [currentDataset, vizStore])

    const editLabelHandler = useCallback((content: string, tabIndex: number) => {
        vizStore.setVisName(tabIndex, content)
    }, [])

    return (
        <DefaultTab
            selectedKey={segmentKey}
            tabs={tabs}
            onEditLabel={editLabelHandler}
            onSelected={(k) => {
                commonStore.setSegmentKey(k as ISegmentKey)
            }}
        />
    );
};

export default observer(SegmentNav);
