import React, { memo } from "react";
import { IToolbarItem, IToolbarProps, ToolbarItemContainer } from "./toolbar-item";
import { useHandlers } from "./components";


export interface ToolbarButtonItem extends IToolbarItem {
    onClick?: () => void;
}

const ToolbarButton = memo<IToolbarProps<ToolbarButtonItem>>(function ToolbarButton(props) {
    const { item, styles, disabled: invisible } = props;
    const { icon: Icon, disabled = false, onClick } = item;
    const handlers = useHandlers(() => onClick?.(), invisible || disabled);

    const mergedIconStyles = {
        ...styles?.icon,
        ...item.styles?.icon,
    };

    return (
        <ToolbarItemContainer
            invisible={invisible}
            props={props}
            handlers={onClick ? handlers : null}
            aria-hidden={invisible}
        >
            <Icon style={mergedIconStyles} />
        </ToolbarItemContainer>
    );
});


export default ToolbarButton;
