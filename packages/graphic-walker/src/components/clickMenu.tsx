import React, { useCallback, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Transition } from '@headlessui/react';

const MenuContainer = styled.div`
    min-width: 100px;
    position: absolute;
    z-index: 99;
    cursor: pointer;
    padding: 4px;
`;
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
            <MenuContainer className="shadow-lg text-sm border rounded-md bg-popover text-popover-foreground border-border" style={{ left, top }}>
                {children}
            </MenuContainer>
        </div>
    );
};

export default ClickMenu;
