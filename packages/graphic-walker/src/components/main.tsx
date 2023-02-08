import { observer } from "mobx-react-lite";
import React from "react";
import { useGlobalStore } from "../store";
import { PrimaryMenuKey } from "../store/viewStore";
import ChartEditor from "./feature/mainView/chartEditor";


export const Main = observer(function Main () {
    const { viewStore } = useGlobalStore();
    const { primaryMenuKey } = viewStore;
    
    return (
        <main className="GW__main flex-1 h-full flex flex-col overflow-hidden">
            {{
                [PrimaryMenuKey.chart]: <ChartEditor />,
            }[primaryMenuKey]}
        </main>
    );
});
