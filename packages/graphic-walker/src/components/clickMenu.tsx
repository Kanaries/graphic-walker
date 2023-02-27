import React from "react";
import styled from "styled-components";

const MenuContainer = styled.div`
    min-width: 100px;
    background-color: #fff;
    border: 1px solid #f0f0f0;
    position: absolute;
    z-index: 99;
    cursor: pointer;
    padding: 4px;
    @media (prefers-color-scheme: dark) {
        background-color: #000;
        border: 1px solid #4b5563;
    }
`;
interface ClickMenuProps {
    x: number;
    y: number;
}

const ClickMenu: React.FC<ClickMenuProps> = (props) => {
    const { x, y, children } = props;
    return (
        <MenuContainer className="shadow-lg text-sm" style={{ left: x + "px", top: y + "px" }}>
            {children}
        </MenuContainer>
    );
};

export default ClickMenu;
