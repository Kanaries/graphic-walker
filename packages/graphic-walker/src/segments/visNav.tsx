import React, { useCallback, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import EditableTabs, { ITabOption } from "../components/tabs/editableTab";
import {  useVizStore } from "../store";


const ADD_KEY = '_add';

const VisNav: React.FC = (props) => {
    const vizStore = useVizStore();
    const { currentVis, visLength, vizList } = vizStore;

    const { t } = useTranslation();

    const tabs: ITabOption[] = vizList.map((v) => ({
        key: v.visId,
        label: v.name ?? 'vis',
        editable: true
    }));

    tabs.push({
        key: ADD_KEY,
        label: t('main.tablist.new')
    });

    const visSelectionHandler = useCallback((tabKey: string, tabIndex: number) => {
        if (tabKey === ADD_KEY) {
            vizStore.addVisualization(idx => t('main.tablist.auto_title', { idx }));
        } else {
            vizStore.selectVisualization(tabIndex);
        }
    }, [vizStore, visLength])

    const editLabelHandler = useCallback((content: string, tabIndex: number) => {
        vizStore.setVisName(tabIndex, content)
    }, [vizStore])

    const deleteHandler = useCallback((tabIndex: number) => {
        vizStore.openRemoveConfirmModal(tabIndex);
    }, [vizStore])

    const dupHandler = useCallback((tabIndex: number) => {
        vizStore.duplicateVisualization(tabIndex);
    }, [vizStore])

    return (
        <EditableTabs
            selectedKey={currentVis.visId}
            tabs={tabs}
            onEditLabel={editLabelHandler}
            onSelected={visSelectionHandler}
            onDuplicate={dupHandler}
            onRemove={deleteHandler}
            showRemove={visLength > 1}
        />
    );
};

export default observer(VisNav);
