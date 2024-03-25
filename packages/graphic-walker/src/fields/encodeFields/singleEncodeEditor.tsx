import React, { useMemo, useContext } from 'react';
import { DraggableFieldState, IAggregator, IDraggableStateKey } from '../../interfaces';
import { observer } from 'mobx-react-lite';
import { DatasetNamesContext, useVizStore } from '../../store';
import { DroppableProvided } from 'react-beautiful-dnd';
import { ChevronUpDownIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { COUNT_FIELD_ID, DEFAULT_DATASET, MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import DropdownContext from '../../components/dropdownContext';
import { GLOBAL_CONFIG } from '../../config';
import { Draggable, DroppableStateSnapshot } from '@kanaries/react-beautiful-dnd';
import styled from 'styled-components';
import SelectContext, { type ISelectContextOption } from '../../components/selectContext';
import { refMapper } from '../fieldsContext';
import Tooltip from '@/components/tooltip';
import { EditNamePopover } from '../renamePanel';
import { getFieldIdentifier } from '@/utils';

const PillActions = styled.div`
    overflow: visible !important;
    width: calc(100% - 1.875rem);
`;

interface SingleEncodeEditorProps {
    dkey: {
        id: keyof Omit<DraggableFieldState, 'filters'>;
    };
    provided: DroppableProvided;
    snapshot: DroppableStateSnapshot;
}
const SingleEncodeEditor: React.FC<SingleEncodeEditorProps> = (props) => {
    const { dkey, provided, snapshot } = props;
    const vizStore = useVizStore();
    const { allEncodings, config, foldOptions, datasetJoinPaths } = vizStore;
    const folds = config.folds ?? [];
    const channelItem = allEncodings[dkey.id][0];
    const { t } = useTranslation();

    const aggregationOptions = useMemo(() => {
        return GLOBAL_CONFIG.AGGREGATOR_LIST.map((op) => ({
            value: op,
            label: t(`constant.aggregator.${op}`),
        }));
    }, []);

    const datasetNames = useContext(DatasetNamesContext);

    return (
        <div className="p-1 select-none relative touch-none" {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
            <div
                className={`p-1.5 bg-muted text-muted-foreground border flex item-center justify-center grow ${
                    snapshot.draggingFromThisWith || snapshot.isDraggingOver || !channelItem ? 'opacity-100' : 'opacity-0'
                } relative z-0`}
            >
                {t('actions.drop_field')}
            </div>
            {channelItem && (
                <Draggable draggableId={`encode_${dkey.id}_${getFieldIdentifier(channelItem)}`} index={0}>
                    {(provided, snapshot) => {
                        const hasMultiJoins = datasetJoinPaths[channelItem.dataset ?? DEFAULT_DATASET]?.length > 1;

                        return (
                            <div
                                ref={refMapper(provided.innerRef)}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={
                                    'flex items-stretch absolute top-0 left-0 right-0 bottom-0 m-1 touch-none' +
                                    (provided.draggableProps.style?.transform ? ' z-10' : '') +
                                    (channelItem.aggName === 'expr' && !config.defaultAggregated ? ' !opacity-50' : '')
                                }
                            >
                                <div
                                    onClick={() => {
                                        vizStore.removeField(dkey.id, 0);
                                    }}
                                    className="grow-0 shrink-0 px-1.5 flex items-center justify-center bg-destructive text-destructive-foreground cursor-pointer"
                                >
                                    <TrashIcon className="w-4" />
                                </div>
                                <PillActions className="flex-1 flex items-center border border-l-0 px-2 space-x-2 truncate">
                                    {channelItem.fid === MEA_KEY_ID && (
                                        <SelectContext
                                            options={foldOptions}
                                            selectedKeys={folds}
                                            onSelect={(keys) => {
                                                vizStore.setVisualConfig('folds', keys);
                                            }}
                                            className="flex-1"
                                        >
                                            <span className="flex-1 truncate" title={channelItem.name}>
                                                {channelItem.name}
                                            </span>
                                        </SelectContext>
                                    )}
                                    {channelItem.fid !== MEA_KEY_ID && (
                                        <span className="flex-1 truncate">
                                            {channelItem.dataset ? `${datasetNames?.[channelItem.dataset] ?? channelItem.dataset}.` : ''}
                                            {channelItem.name}
                                        </span>
                                    )}
                                    {hasMultiJoins && channelItem.joinPath && (
                                        <EditNamePopover
                                            defaultValue={channelItem.name}
                                            onSubmit={(name) => vizStore.editFieldName(props.dkey.id, 0, name)}
                                            desc={
                                                <div className="text-xs">
                                                    This Field is Joined with below:
                                                    <pre className="my-1">{vizStore.renderJoinPath(channelItem.joinPath ?? [], datasetNames)}</pre>
                                                </div>
                                            }
                                        >
                                            <PencilSquareIcon className="w-3 h-3 ml-1" />
                                        </EditNamePopover>
                                    )}
                                    {channelItem.analyticType === 'measure' &&
                                        channelItem.fid !== COUNT_FIELD_ID &&
                                        config.defaultAggregated &&
                                        channelItem.aggName !== 'expr' && (
                                            <DropdownContext
                                                options={aggregationOptions}
                                                onSelect={(value) => {
                                                    vizStore.setFieldAggregator(dkey.id, 0, value as IAggregator);
                                                }}
                                            >
                                                <span className="bg-transparent text-muted-foreground float-right focus:outline-none focus: dark:focus: flex items-center ml-2">
                                                    {channelItem.aggName || ''}
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
