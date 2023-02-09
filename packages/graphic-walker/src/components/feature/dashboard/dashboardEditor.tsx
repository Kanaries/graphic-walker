import React from 'react';
import { observer } from 'mobx-react-lite';
import styled from 'styled-components';
import { useDashboardContext } from '../../../store/dashboard';
import { useBlockConfigs } from '../../../store/dashboard/workspace';


const Root = styled.div`
    cursor: default;
    background-color: var(--page-background);
    display: flex;
    overflow: hidden;
`;

const DashboardEditor = observer(function DashboardEditor () {
    const block = useBlockConfigs();
    const { dashboard } = useDashboardContext();

    const RootLayout = block.layout?.onRender;
    
    return dashboard ? (
        <Root
            style={{
                width: `${dashboard.size.width}px`,
                height: `${dashboard.size.height}px`,
                padding: `${dashboard.size.padding}px`,
                // @ts-expect-error css variable
                '--spacing': `${dashboard.size.spacing}px`,
            }}
        >
            {RootLayout && <RootLayout data={dashboard.items} />}
        </Root>
    ) : null;
});

export default DashboardEditor;
