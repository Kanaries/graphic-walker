import { observer } from "mobx-react-lite";
import React from "react";
import { useGlobalStore } from "../store";
import { PrimaryMenuKey } from "../store/viewStore";
import ChartEditor from "./feature/chart/chartEditor";
import DashboardEditor from "./feature/dashboard/dashboardEditor";


export const Main = observer<{ direction: 'portrait' | 'landscape' }>(function Main ({ direction }) {
    const { viewStore } = useGlobalStore();
    const { primaryMenuKey, showPrimarySideBar } = viewStore;

    if (showPrimarySideBar && direction === 'portrait') {
        return null;
    }
    
    return (
        <main className="GW__main flex-1 h-full flex flex-col overflow-hidden">
            {{
                [PrimaryMenuKey.chart]: <ChartEditor />,
                [PrimaryMenuKey.dashboard]: <DashboardEditor />,
            }[primaryMenuKey]}
        </main>
    );
});
