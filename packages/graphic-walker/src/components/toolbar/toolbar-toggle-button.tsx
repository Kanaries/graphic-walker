import React, { memo } from 'react';
import { IToolbarItem, IToolbarProps } from './toolbar-item';
import { Toggle } from '../ui/toggle';
import { ToolbarItemContainer } from './container';

export interface ToolbarToggleButtonItem extends IToolbarItem {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const ToolbarToggleButton = memo<IToolbarProps<ToolbarToggleButtonItem>>(function ToolbarToggleButton(props) {
    const { item } = props;
    const { icon: Icon, disabled, checked, onChange, styles } = item;

    return (
        <ToolbarItemContainer {...props}>
            <Toggle variant="none" disabled={disabled} size="toolbar" pressed={checked} onPressedChange={onChange}>
                <Icon className="w-[18px] h-[18px]" style={styles?.icon} />
            </Toggle>
        </ToolbarItemContainer>
    );
});

export default ToolbarToggleButton;
