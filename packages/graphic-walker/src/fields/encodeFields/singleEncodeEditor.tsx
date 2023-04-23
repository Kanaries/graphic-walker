import React, { useMemo } from 'react';
import { IDraggableStateKey } from '../../interfaces';
import { observer } from 'mobx-react-lite';
import { useGlobalStore } from '../../store';
import { DroppableProvided } from 'react-beautiful-dnd';
import { ChevronUpDownIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { COUNT_FIELD_ID } from '../../constants';
import DropdownContext from '../../components/dropdownContext';
import { AGGREGATOR_LIST } from '../fieldsContext';
import { Draggable, DroppableStateSnapshot } from '@kanaries/react-beautiful-dnd';
import styled from 'styled-components';

const PillActions = styled.div`
    overflow: visible !important;
    width: calc(100% - 1.875rem);
`;

interface SingleEncodeEditorProps {
    dkey: IDraggableStateKey;
    provided: DroppableProvided;
    snapshot: DroppableStateSnapshot;
}
const SingleEncodeEditor: React.FC<SingleEncodeEditorProps> = (props) => {
    const { dkey, provided, snapshot } = props;
    const { vizStore } = useGlobalStore();
    const { draggableFieldState, visualConfig } = vizStore;
    const channelItem = draggableFieldState[dkey.id][0];
    const { t } = useTranslation();

    const aggregationOptions = useMemo(() => {
        return AGGREGATOR_LIST.map((op) => ({
            value: op,
            label: t(`constant.aggregator.${op}`),
        }));
    }, []);

    return (
        <div className="p-1 select-none relative" {...provided.droppableProps} ref={provided.innerRef}>
            <div className={`p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex item-center justify-center grow text-gray-500 dark:text-gray-400 ${snapshot.draggingFromThisWith || snapshot.isDraggingOver || !channelItem ? 'opacity-100' : 'opacity-0'} relative z-0`}>
                {t('actions.drop_field')}
            </div>
            {channelItem && (
                <Draggable key={channelItem.dragId} draggableId={channelItem.dragId} index={0}>
                    {(provided, snapshot) => {
                        return (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="flex items-stretch absolute z-10 top-0 left-0 right-0 bottom-0 m-1">
                                <div
                                    onClick={() => {
                                        vizStore.removeField(dkey.id, 0);
                                    }}
                                    className="grow-0 shrink-0 px-1.5 flex items-center justify-center bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 cursor-pointer"
                                >
                                    <TrashIcon className="w-4" />
                                </div>
                                <PillActions className="flex-1 flex items-center border border-gray-200 dark:border-gray-700 border-l-0 px-2 space-x-2 truncate">
                                    <span className="flex-1 truncate">
                                        {channelItem.name}
                                    </span>
                                    {channelItem.analyticType === "measure" && channelItem.fid !== COUNT_FIELD_ID && visualConfig.defaultAggregated && (
                                        <DropdownContext
                                            options={aggregationOptions}
                                            onSelect={(value) => {
                                                vizStore.setFieldAggregator(dkey.id, 0, value);
                                            }}
                                        >
                                            <span className="bg-transparent text-gray-700 dark:text-gray-200 float-right focus:outline-none focus:border-gray-500 dark:focus:border-gray-400 flex items-center ml-2">
                                                {channelItem.aggName || ""}
                                                <ChevronUpDownIcon className="w-3" />
                                            </span>
                                        </DropdownContext>
                                    )}
                                </PillActions>
                            </div>
                        );
                    }}
                </Draggable>
            )}
        </div>
    );
};

export default observer(SingleEncodeEditor);
