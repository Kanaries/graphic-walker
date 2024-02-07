import React, { memo } from 'react';
import { IToolbarItem, IToolbarProps } from './toolbar-item';
import { Button, buttonVariants } from '../ui/button';
import { ToolbarItemContainer } from './container';

export interface ToolbarButtonItem extends IToolbarItem {
    onClick?: () => void;
    href?: string;
}

const ToolbarButton = memo<IToolbarProps<ToolbarButtonItem>>(function ToolbarButton(props) {
    const { item } = props;
    const { icon: Icon, styles, disabled, onClick, href } = item;

    return (
        <ToolbarItemContainer {...props} splitOnly={!onClick}>
            {href && (
                <a href={href} target="_blank" className={buttonVariants({ variant: 'none', size: 'toolbar' })} aria-disabled={disabled}>
                    <Icon className="w-[18px] h-[18px]" style={styles?.icon} />
                </a>
            )}
            {!href && (
                <Button variant="none" size="toolbar" onClick={onClick} disabled={disabled}>
                    <Icon className="w-[18px] h-[18px]" style={styles?.icon} />
                </Button>
            )}
        </ToolbarItemContainer>
    );
});

export default ToolbarButton;
