import React, { useCallback, useMemo } from 'react';
import { Draggable, DroppableProvided } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { useVizStore } from '../../store';
import DataTypeIcon from '../../components/dataTypeIcon';
import ActionMenu from '../../components/actionMenu';
import { useMenuActions } from './utils';
import { FieldPill } from './fieldPill';
import { MEA_KEY_ID } from '../../constants';
import { refMapper } from '../fieldsContext';
import { getFieldIdentifier } from '@/utils';
import { buildDatasetFieldTargetId } from '../../agent/targets';
import { useHoverEmitter } from '../../agent/useHoverEmitter';

const MeaFields: React.FC = (props) => {
    const vizStore = useVizStore();
    const { measures } = vizStore;
    const emitHover = useHoverEmitter();
    const instanceId = vizStore.instanceID;

    const menuActions = useMenuActions('measures');

    return (
        <div className='relative touch-none' data-gw-channel-container='measures'>
            {measures.map((f, index) => {
                const targetId = buildDatasetFieldTargetId(instanceId, f.fid, f.analyticType);
                const meta = { fid: f.fid, name: f.name, channel: 'dataset:measures', index };
                return (
                    <Draggable key={getFieldIdentifier(f)} draggableId={`measure_${getFieldIdentifier(f)}`} index={index}>
                        {(provided, snapshot) => (
                            <div className="block">
                                <ActionMenu
                                    title={f.name || f.fid}
                                    menu={menuActions[index]}
                                    enableContextMenu
                                    disabled={snapshot.isDragging || f.fid === MEA_KEY_ID}
                                >
                                    <FieldPill
                                        data-gw-target={targetId}
                                        onPointerEnter={() => emitHover('enter', targetId, 'dataset-field', meta)}
                                        onPointerLeave={() => emitHover('leave', targetId, 'dataset-field', meta)}
                                        className={`touch-none flex pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-measure/20 rounded-md truncate border border-transparent ${
                                            snapshot.isDragging ? 'bg-measure/20' : ''
                                        }`}
                                        isDragging={snapshot.isDragging}
                                        ref={refMapper(provided.innerRef)}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                    >
                                        <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                        <span className="ml-0.5" title={f.name}>
                                            {f.name}
                                        </span>
                                        <ActionMenu.Button as="div">
                                            <EllipsisVerticalIcon className="w-4 h-4" />
                                        </ActionMenu.Button>
                                    </FieldPill>
                                    {
                                        <FieldPill
                                            className={`pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-measure/20 rounded-md border-measure border truncate ${
                                                snapshot.isDragging ? 'bg-measure/20 flex' : 'hidden'
                                            }`}
                                            isDragging={snapshot.isDragging}
                                        >
                                            <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                            <span className="ml-0.5" title={f.name}>
                                                {f.name}
                                            </span>
                                            <ActionMenu.Button as="div">
                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                            </ActionMenu.Button>
                                        </FieldPill>
                                    }
                                </ActionMenu>
                            </div>
                        )}
                    </Draggable>
                );
            })}
        </div>
    );
};

export default observer(MeaFields);
