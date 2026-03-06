import React from 'react';
import { SketchPicker } from 'react-color';

type StyledPickerProps = React.ComponentProps<typeof SketchPicker> & {
    noShadow?: boolean;
    noBorder?: boolean;
};

export const StyledPicker: React.FC<StyledPickerProps> = ({ noShadow, noBorder, ...props }) => {
    return (
        <div className="gw-sketch-picker-wrap" data-no-shadow={noShadow ? 'true' : 'false'} data-no-border={noBorder ? 'true' : 'false'}>
            <SketchPicker {...props} className={`gw-sketch-picker ${props.className ?? ''}`.trim()} />
        </div>
    );
};
