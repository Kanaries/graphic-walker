import React from "react";
import styled from "styled-components";

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
    return (
        <MenuContainer className="shadow-lg text-sm bg-white border border-gray-100 dark:bg-black dark:border-gray-700" style={{ left: x + "px", top: y + "px" }}>
            {children}
        </MenuContainer>
    );
};

export default ClickMenu;
