import React from 'react';
import { DRAGGABLE_STATE_KEYS } from '../utils/dnd.config';
import { AestheticFieldContainer } from './components'
// import OBFieldContainer from './obComponents/obFContainer';
import SingleEncodeEditor from './encodeFields/singleEncodeEditor';

const aestheticFields = DRAGGABLE_STATE_KEYS.filter(f => ['color', 'opacity', 'size', 'shape'].includes(f.id));

const AestheticFields: React.FC = props => {
    return <div className="grid grid-cols-2 @xl:grid-cols-1">
        {
            aestheticFields.map(dkey => <AestheticFieldContainer name={dkey.id} key={dkey.id}>
                <SingleEncodeEditor dkey={dkey} />
            </AestheticFieldContainer>)
        }
    </div>
}

export default AestheticFields;