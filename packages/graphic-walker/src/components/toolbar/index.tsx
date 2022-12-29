import React, { CSSProperties, memo, useState } from "react";
import styled from "styled-components";
import { ToolbarContainer, ToolbarSplitter } from "./components";
import ToolbarItem, { ToolbarItemProps, ToolbarItemSplitter } from "./toolbar-item";


const Root = styled.div`
    width: 100%;
    --background-color: #f7f7f7;
    --color: #777;
    --color-hover: #555;
    --blue: #282958;
    --blue-dark: #1d1e38;
`;

export interface ToolbarProps {
    items: ToolbarItemProps[];
    styles?: Partial<{
        root: CSSProperties & Record<string, string>;
        container: CSSProperties & Record<string, string>;
        item: CSSProperties & Record<string, string>;
        icon: CSSProperties & Record<string, string>;
        splitIcon: CSSProperties & Record<string, string>;
    }>;
}

const Toolbar = memo<ToolbarProps>(function Toolbar ({ items, styles }) {
    // const layerId = useId();
    const [openedKey, setOpenedKey] = useState<string | null>(null);

    return (
        <Root style={styles?.root}>
            <ToolbarContainer style={styles?.container}>
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
                        />
                    );
                })}
            </ToolbarContainer>
            {/* <LayerHost id={layerId} /> */}
        </Root>
    );
});


export default Toolbar;
export type { ToolbarItemProps };
