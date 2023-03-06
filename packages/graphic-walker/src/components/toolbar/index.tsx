import React, { CSSProperties, memo, ReactNode, useState } from "react";
import styled from "styled-components";
import type { IDarkMode } from "../../interfaces";
import { useCurrentMediaTheme } from "../../utils/media";
import { ToolbarContainer, ToolbarSplitter } from "./components";
import ToolbarItem, { ToolbarItemProps, ToolbarItemSplitter } from "./toolbar-item";


const Root = styled.div<{ darkModePreference: IDarkMode }>`
    width: 100%;
    --background-color: #f7f7f7;
    --color: #777;
    --color-hover: #555;
    --blue: #282958;
    --blue-dark: #1d1e38;
    --dark-mode-background-color: #1f1f1f;
    --dark-mode-color: #aaa;
    --dark-mode-color-hover: #ccc;
    --dark-mode-blue: #282958;
    --dark-mode-blue-dark: #1d1e38;
    --dark-mode-preference: ${({ darkModePreference }) => darkModePreference};
`;

export interface ToolbarProps {
    darkModePreference?: IDarkMode;
    items: ToolbarItemProps[];
    styles?: Partial<{
        root: CSSProperties & Record<string, string>;
        container: CSSProperties & Record<string, string>;
        item: CSSProperties & Record<string, string>;
        icon: CSSProperties & Record<string, string>;
        splitIcon: CSSProperties & Record<string, string>;
    }>;
}

const Toolbar = memo<ToolbarProps>(function Toolbar ({ darkModePreference = 'media', items, styles }) {
    const [openedKey, setOpenedKey] = useState<string | null>(null);
    const [slot, setSlot] = useState<ReactNode>(null);

    const dark = useCurrentMediaTheme(darkModePreference) === 'dark';

    return (
        <Root darkModePreference={darkModePreference} style={styles?.root}>
            <ToolbarContainer dark={dark} style={styles?.container}>
                {items.map((item, i) => {
                    if (item === ToolbarItemSplitter) {
                        return <ToolbarSplitter key={i} />;
                    }
                    return (
                        <ToolbarItem
                            key={item.key}
                            item={item}
                            styles={styles}
                            openedKey={openedKey}
                            setOpenedKey={setOpenedKey}
                            renderSlot={node => setSlot(node)}
                            darkModePreference={darkModePreference}
                        />
                    );
                })}
            </ToolbarContainer>
            {slot}
        </Root>
    );
});


export default Toolbar;
export type { ToolbarItemProps };
