import React, { useCallback, useMemo } from 'react';
import { Draggable, DroppableProvided } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { useVizStore } from '../../store';
import DataTypeIcon from '../../components/dataTypeIcon';
import ActionMenu from '../../components/actionMenu';
import { useMenuActions } from './utils';
import { FieldPill } from './fieldPill';
import { MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { refMapper } from '../fieldsContext';
import { getFieldIdentifier } from '@/utils';

const MeaFields: React.FC = (props) => {
    const vizStore = useVizStore();
    // read in the observer render scope: the render prop below runs outside mobx tracking
    const { measures, selectedFieldIds } = vizStore;

    const menuActions = useMenuActions('measures');

    return (
        <div className='relative touch-none'>
            {measures.map((f, index) => (
                <Draggable key={getFieldIdentifier(f)} draggableId={`measure_${getFieldIdentifier(f)}`} index={index}>
                    {(provided, snapshot) => {
                        const selectable = f.fid !== MEA_KEY_ID && f.fid !== MEA_VAL_ID;
                        const selected = selectable && selectedFieldIds.includes(f.fid);
                        return (
                            <div className="block">
                                <ActionMenu
                                    title={f.name || f.fid}
                                    menu={menuActions[index]}
                                    enableContextMenu
                                    disabled={snapshot.isDragging || f.fid === MEA_KEY_ID}
                                >
                                    <FieldPill
                                        data-field-pill
                                        onClick={(e) => {
                                            if (!selectable) {
                                                return;
                                            }
                                            if (e.metaKey || e.ctrlKey) {
                                                vizStore.toggleFieldSelection(f.fid);
                                            } else {
                                                vizStore.selectField(f.fid);
                                            }
                                        }}
                                        className={`touch-none flex pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-measure/20 rounded-md truncate border ${
                                            selected ? 'border-primary/50 bg-primary/10' : 'border-transparent'
                                        } ${snapshot.isDragging ? 'bg-measure/20' : ''}`}
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
                        );
                    }}
                </Draggable>
            ))}
        </div>
    );
};

export default observer(MeaFields);
