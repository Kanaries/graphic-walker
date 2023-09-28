import React, { useCallback, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import EditableTabs, { ITabOption } from "../components/tabs/editableTab";
import { useGlobalStore } from "../store";


const ADD_KEY = '_add';

const VisNav: React.FC = (props) => {
    const { vizStore, commonStore } = useGlobalStore();
    const { visIndex, visList } = vizStore;
    const { currentDataset } = commonStore;

    const { t } = useTranslation();

    const tabs: ITabOption[] = visList.map((v) => ({
        key: v.visId,
        label: v.name ?? 'vis',
        editable: true
    }));

    tabs.push({
        key: ADD_KEY,
        label: t('main.tablist.new')
    });

    useEffect(() => {
        if (visList.length === 1) {
            // should set the first vis name when the component is mounted
            vizStore.setVisName(0, t('main.tablist.auto_title', { idx: 1 }));
        }
        // no need to add deps here
    }, [])

    const visSelectionHandler = useCallback((tabKey: string, tabIndex: number) => {
        if (tabKey === ADD_KEY) {
            vizStore.addVisualization(t('main.tablist.auto_title', { idx: visList.length + 1 }));
            vizStore.initMetaState(currentDataset)
        } else {
            vizStore.selectVisualization(tabIndex);
        }
    }, [currentDataset, vizStore, visList.length])

    const editLabelHandler = useCallback((content: string, tabIndex: number) => {
        vizStore.setVisName(tabIndex, content)
    }, [])

    const deleteHandler = useCallback((tabIndex: number) => {
        vizStore.openRemoveConfirmModal(tabIndex);
    }, [])

    return (
        <EditableTabs
            selectedKey={visList[visIndex].visId}
            tabs={tabs}
            onEditLabel={editLabelHandler}
            onSelected={visSelectionHandler}
            onRemove={deleteHandler}
            showRemove={visList.length > 1}
        />
    );
};

export default observer(VisNav);
