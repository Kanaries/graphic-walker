import React from 'react';
import { Droppable } from "@kanaries/react-beautiful-dnd";
import { DRAGGABLE_STATE_KEYS } from './fieldsContext';
import { AestheticFieldContainer } from './components'
import OBFieldContainer from './obComponents/obFContainer';
import SingleEncodeEditor from './encodeFields/singleEncodeEditor';

const aestheticFields = DRAGGABLE_STATE_KEYS.filter(f => ['color', 'opacity', 'size', 'shape'].includes(f.id));

const AestheticFields: React.FC = props => {
    return <div>
        {
            aestheticFields.map(dkey => <AestheticFieldContainer name={dkey.id} key={dkey.id}>
                <Droppable droppableId={dkey.id} direction="horizontal">
                    {(provided, snapshot) => (
                        // <OBFieldContainer dkey={dkey} provided={provided} />
                        <SingleEncodeEditor dkey={dkey} provided={provided} snapshot={snapshot} />
                    )}
                </Droppable>
            </AestheticFieldContainer>)
        }
    </div>
}

export default AestheticFields;