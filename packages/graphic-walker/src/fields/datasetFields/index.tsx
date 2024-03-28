import React from 'react';
import { Droppable } from '@kanaries/react-beautiful-dnd';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import DimFields from './dimFields';
import MeaFields from './meaFields';
import { refMapper } from '../fieldsContext';

const DSContainer = styled.div`
    @media (min-width: 640px) {
        height: 680px;
    }
`;

const DatasetFields: React.FC = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.DatasetFields' });

    return (
        <DSContainer className="p-1 sm:mr-0.5 my-0.5 border flex sm:flex-col" style={{ paddingBlock: 0, paddingInline: '0.6em' }}>
            <h4 className="text-xs mb-2 flex-grow-0 cursor-default select-none mt-2">{t('field_list')}</h4>
            <Droppable droppableId="dimensions" direction="vertical">
                {(provided, snapshot) => (
                    <div {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                        <div className="pd-1 overflow-y-auto" style={{ maxHeight: '380px', minHeight: '100px' }}>
                            <DimFields />
                        </div>
                    </div>
                )}
            </Droppable>
            <Droppable droppableId="measures" direction="vertical">
                {(provided, snapshot) => (
                    <div {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                        <div className="border-t flex-grow pd-1 overflow-y-auto">
                            <MeaFields />
                        </div>
                    </div>
                )}
            </Droppable>
        </DSContainer>
    );
};

export default DatasetFields;
