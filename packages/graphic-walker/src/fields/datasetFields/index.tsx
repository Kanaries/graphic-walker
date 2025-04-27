import React from 'react';
import { Droppable } from '@kanaries/react-beautiful-dnd';
import { useTranslation } from 'react-i18next';
import DimFields from './dimFields';
import MeaFields from './meaFields';
import { refMapper } from '../fieldsContext';

const DatasetFields: React.FC = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.DatasetFields' });

    return (
        <div className="p-1 sm:mr-0.5 my-0.5 border flex sm:flex-col sm:h-full" style={{ paddingBlock: 0, paddingInline: '0.6em' }}>
            <h4 className="text-xs mb-2 flex-grow-0 cursor-default select-none mt-2">{t('field_list')}</h4>
            <Droppable droppableId="dimensions" direction="vertical">
                {(provided, snapshot) => (
                    <div className="flex-shrink min-w-[0px] min-h-[100px] sm:max-h-[380px] sm:overflow-y-auto" {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                        <div className="pd-1">
                            <DimFields />
                        </div>
                    </div>
                )}
            </Droppable>
            <Droppable droppableId="measures" direction="vertical">
                {(provided, snapshot) => (
                    <div className="flex-shrink flex-grow min-w-[0px] min-h-[200px] sm:overflow-y-auto flex-1" {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                        <div className="border-t flex-grow pd-1 overflow-y-auto h-full">
                            <MeaFields />
                        </div>
                    </div>
                )}
            </Droppable>
        </div>
    );
};

export default DatasetFields;
