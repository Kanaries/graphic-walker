import React, { useCallback, useState } from 'react';
interface ClickMenuProps {
    x: number;
    y: number;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}

const ClickMenu: React.FC<ClickMenuProps> = (props) => {
    const { x, y, children } = props;
    const [rect, setRect] = useState<DOMRect>();
    const containerCb = useCallback((el: HTMLDivElement) => {
        if (el) {
            setRect(el.getBoundingClientRect());
        }
    }, []);
    const left = x - (rect?.left ?? 0);
    const top = y - (rect?.top ?? 0);
    return (
        <div ref={containerCb}>
            <div className="min-w-[100px] absolute z-[99] cursor-pointer p-1 shadow-lg text-sm border rounded-md bg-popover text-popover-foreground border-border" style={{ left, top }}>
                {children}
            </div>
        </div>
    );
};

export default ClickMenu;
