import React from "react";
import { IDraggableStateKey } from "../../interfaces";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DropdownSelect from "./singleEncodeDropDown";
import { DroppableProvided } from "react-beautiful-dnd";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

interface SingleEncodeEditorProps {
    dkey: IDraggableStateKey;
    provided: DroppableProvided;
}
const SingleEncodeEditor: React.FC<SingleEncodeEditorProps> = (props) => {
    const { dkey, provided } = props;
    const { vizStore } = useGlobalStore();
    const { draggableFieldState } = vizStore;
    const channelItem = draggableFieldState[dkey.id][0];
    const allFieldOptions = draggableFieldState.dimensions.concat(draggableFieldState.measures).map((f) => ({
        value: f.fid,
        label: f.name,
    }));
    const { t } = useTranslation();
    return (
        <div className="p-1 flex items-center relative" {...provided.droppableProps} ref={provided.innerRef}>
            {channelItem && (
                <div
                    onClick={() => {
                        vizStore.removeField(dkey.id, 0);
                    }}
                    className="p-1.5 bg-red-50 dark:bg-red-900 shrink-0 grow-0 border border-red-200 dark:border-red-700 cursor-pointer"
                >
                    <TrashIcon className="w-4" />
                </div>
            )}
            {channelItem && (
                <DropdownSelect className="shrink grow static" buttonClassName="rounded-none" options={allFieldOptions} selectedKey={channelItem.fid} onSelect={(value) => {}} />
            )}
            {!channelItem && <div className="p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex item-center justify-center grow text-gray-500 dark:text-gray-400">
                {t('actions.drop_field')}</div>}
        </div>
    );
};

export default observer(SingleEncodeEditor);
