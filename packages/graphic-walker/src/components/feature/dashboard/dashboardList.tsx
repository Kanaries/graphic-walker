import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "@heroicons/react/24/outline";
import Tooltip from "../../tooltip";
import DashboardTitle from "./dashboardTitle";
import { useDashboardContext } from "../../../store/dashboard";
import { useGlobalStore } from "../../../store";

const DashboardList = observer(function DashboardList () {
    const { t } = useTranslation();
    const { commonStore } = useGlobalStore();
    const { currentDataset } = commonStore;
    const ctx = useDashboardContext();
    const { dashboards, dashboardIdx } = ctx;

    const [editingIdx, setEditingIdx] = useState(-1);

    useEffect(() => {
        setEditingIdx(-1);
    }, [dashboards, dashboardIdx]);

    useEffect(() => {
        if (editingIdx === -1) {
            const cb = (): void => {
                setEditingIdx(-1);
            };
            document.addEventListener('click', cb);
            return () => document.removeEventListener('click', cb);
        }
    }, [editingIdx]);

    return (
        <div className="flex-1 w-full h-full max-h-full overflow-hidden py-2 px-2 text-sm flex flex-col" style={{ minWidth: '10em' }}>
            <header className="flex-grow-0 flex-shrink-0 mt-1 mb-2 text-center cursor-default flex items-center justify-center">
                <span className="mx-3">
                    {t('primary_menu_key.dashboard')}
                </span>
                <Tooltip content={t('dashboard.new')} distance={6}>
                    <div
                        role="button"
                        aria-label={t('dashboard.new')}
                        tabIndex={0}
                        className="w-5 h-5 p-0.5 rounded-sm hover:bg-slate-200"
                        onClick={() => {
                            ctx.addPage(currentDataset);
                        }}
                    >
                        <PlusIcon />
                    </div>
                </Tooltip>
            </header>
            <div className="flex-1 flex flex-col pb-8 items-stretch overflow-y-scroll overflow-x-hidden">
                {dashboards.map((dashboard, idx) => (
                    <DashboardTitle
                        key={idx}
                        idx={idx}
                        data={dashboard}
                        editingIdx={editingIdx}
                        setEditingIdx={i => setEditingIdx(i)}
                    />
                ))}
            </div>
        </div>
    );
});

export default DashboardList;
