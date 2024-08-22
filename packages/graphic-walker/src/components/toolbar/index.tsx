import React, { memo, useState, CSSProperties } from 'react';
import ToolbarItem, { ToolbarItemProps, ToolbarItemSplitter } from './toolbar-item';
import { Separator } from '../ui/separator';

export interface ToolbarProps {
    items: ToolbarItemProps[];
    styles?: Partial<{
        item: CSSProperties & Record<string, string>;
        icon: CSSProperties & Record<string, string>;
        splitIcon: CSSProperties & Record<string, string>;
    }>;
}

const Toolbar = memo<ToolbarProps>(function Toolbar({ items }) {
    const [openedKey, setOpenedKey] = useState<string | null>(null);

    return (
        <div className="flex flex-wrap lg:flex-nowrap border my-1 w-full rounded overflow-hidden">
            {items.map((item, i) => {
                if (item === ToolbarItemSplitter) {
                    return <Separator orientation="vertical" className="mx-1 my-1.5 h-6" key={i} />;
                }
                return <ToolbarItem key={item.key} item={item} openedKey={openedKey} setOpenedKey={setOpenedKey} />;
            })}
        </div>
    );
});

export default Toolbar;
export type { ToolbarItemProps };
