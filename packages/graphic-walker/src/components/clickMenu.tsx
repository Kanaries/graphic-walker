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
            <div
                className="z-[99] p-1 cursor-pointer absolute min-w-[100px] shadow-lg text-sm border rounded-md bg-popover text-popover-foreground border-border"
                style={{ left, top }}
            >
                {children}
            </div>
        </div>
    );
};

export default ClickMenu;
