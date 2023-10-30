import React, { useCallback, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

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
        <div className="absolute inset-0" ref={containerCb}>
            <MenuContainer className="shadow-lg text-sm bg-white border border-gray-100 dark:bg-black dark:border-gray-700" style={{ left, top }}>
                {children}
            </MenuContainer>
        </div>
    );
};

export default ClickMenu;
