import React, { memo } from "react";
import { IToolbarItem, IToolbarProps, ToolbarItemContainer } from "./toolbar-item";
import { useHandlers } from "./components";


export interface ToolbarButtonItem extends IToolbarItem {
    onClick?: () => void;
}

const ToolbarButton = memo<IToolbarProps<ToolbarButtonItem>>(function ToolbarButton(props) {
    const { item, styles } = props;
    const { icon: Icon, label, disabled, onClick } = item;
    const handlers = useHandlers(() => onClick?.(), disabled ?? false);

    return (
        <>
            <ToolbarItemContainer
                props={props}
                handlers={onClick ? handlers : null}
            >
                <Icon style={styles?.icon} />
            </ToolbarItemContainer>
        </>
    );
});


export default ToolbarButton;
