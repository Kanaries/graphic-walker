import { observer } from "mobx-react-lite";
import React from "react";
import { useTranslation } from "react-i18next";
import { useGlobalStore } from "../store";
import { PrimaryMenuItems, PrimaryMenuKey } from "../store/viewStore";
import ChartList from "./feature/chart/chartList";
import DashboardList from "./feature/dashboard/dashboardList";
import Tooltip from "./tooltip";


export const PrimarySideBar = observer<{ direction: 'portrait' | 'landscape' }>(function PrimarySideBar ({ direction }) {
    const { t } = useTranslation();
    const { viewStore } = useGlobalStore();
    const { showPrimarySideBar, primaryMenuKey } = viewStore;
    
    return (
        <aside className={`GW__primarySideBar h-full border-r border-gray-200 flex flex-row overflow-hidden ${direction === 'portrait' && showPrimarySideBar ? 'flex-1 border-r-0' : ''}`}>
            <div role="tablist" className="h-full flex flex-col items-center">
                {PrimaryMenuItems.map(item => {
                    const Icon = item.icon;
                    const title = t(`primary_menu_key.${item.key}`);
                    const isCurrentKey = item.key === primaryMenuKey;

                    return (
                        <Tooltip at="right" key={item.key} content={title} showDelay={0} hideDelay={0}>
                            <div
                                key={item.key}
                                role="tab"
                                aria-selected={isCurrentKey}
                                tabIndex={0}
                                className="outline-none cursor-pointer w-full p-2 text-slate-300 hover:text-slate-900 aria-selected:text-slate-900 select-none"
                                onClick={() => {
                                    if (isCurrentKey) {
                                        viewStore.togglePrimarySideBar();
                                    } else {
                                        viewStore.setPrimaryMenuKey(item.key);
                                        viewStore.togglePrimarySideBar(true);
                                    }
                                }}
                            >
                                <Icon width="24" height="24" />
                            </div>
                        </Tooltip>
                    );
                })}
            </div>
            {showPrimarySideBar && (
                <div className="flex-1 h-full flex flex-col items-stretch bg-slate-50 overflow-hidden">
                    {{
                        [PrimaryMenuKey.chart]: <ChartList />,
                        [PrimaryMenuKey.dashboard]: <DashboardList />,
                    }[primaryMenuKey]}
                </div>
            )}
        </aside>
    );
});
