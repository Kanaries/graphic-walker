import React, { memo } from 'react';
import ToolbarButton, { ToolbarButtonItem } from './toolbar-button';
import ToolbarToggleButton, { ToolbarToggleButtonItem } from './toolbar-toggle-button';
import ToolbarSelectButton, { ToolbarSelectButtonItem } from './toolbar-select-button';
import { ToolbarProps } from '.';
export interface IToolbarItem {
    key: string;
    icon: (
        props: React.ComponentProps<'svg'> & {
            title?: string;
            titleId?: string;
        }
    ) => React.ReactNode;
    label: string;
    /** @default false */
    disabled?: boolean;
    form?: React.ReactNode;
    styles?: ToolbarProps['styles'];
}

export const ToolbarItemSplitter = '-';

export type ToolbarItemProps = ToolbarButtonItem | ToolbarToggleButtonItem | ToolbarSelectButtonItem | typeof ToolbarItemSplitter;
export interface IToolbarProps<P extends Exclude<ToolbarItemProps, typeof ToolbarItemSplitter> = Exclude<ToolbarItemProps, typeof ToolbarItemSplitter>> {
    item: P;
    openedKey: string | null;
    setOpenedKey: (key: string | null) => void;
}

const ToolbarItem = memo<{
    item: Exclude<ToolbarItemProps, typeof ToolbarItemSplitter>;
    openedKey: string | null;
    setOpenedKey: (key: string | null) => void;
}>(function ToolbarItem(props) {
    if ('checked' in props.item) {
        return <ToolbarToggleButton item={props.item} openedKey={props.openedKey} setOpenedKey={props.setOpenedKey} />;
    } else if ('options' in props.item) {
        return <ToolbarSelectButton item={props.item} openedKey={props.openedKey} setOpenedKey={props.setOpenedKey} />;
    }
    return <ToolbarButton {...props} />;
});

export default ToolbarItem;
