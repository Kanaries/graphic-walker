import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useGlobalStore } from "../../../store";
import Tooltip from "../../tooltip";
import ChartTitle from "./chartTitle";

const ChartList = observer(function ChartList () {
    const { t } = useTranslation();
    const { vizStore, commonStore } = useGlobalStore();
    const { visList, visIndex } = vizStore;
    const { currentDataset } = commonStore;

    const [editingIdx, setEditingIdx] = useState(-1);

    useEffect(() => {
        setEditingIdx(-1);
    }, [visList, visIndex]);

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
        <div className="flex-1 w-40 h-full max-h-full overflow-hidden py-2 px-2 text-sm flex flex-col">
            <header className="flex-grow-0 flex-shrink-0 mt-1 mb-2 text-center cursor-default flex items-center justify-center">
                <span className="mx-3">
                    {t('primary_menu_key.chart')}
                </span>
                <Tooltip content={t('main.tablist.new')} distance={6}>
                    <div
                        role="button"
                        aria-label={t('main.tablist.new')}
                        tabIndex={0}
                        className="w-5 h-5 p-0.5 rounded-sm hover:bg-slate-200"
                        onClick={() => {
                            vizStore.addVisualization();
                            vizStore.initMetaState(currentDataset);
                        }}
                    >
                        <PlusIcon />
                    </div>
                </Tooltip>
            </header>
            <div className="flex-1 flex flex-col pb-8 items-stretch overflow-y-scroll overflow-x-hidden">
                {visList.map((page, idx) => (
                    <ChartTitle
                        key={idx}
                        idx={idx}
                        data={page}
                        editingIdx={editingIdx}
                        setEditingIdx={i => setEditingIdx(i)}
                    />
                ))}
            </div>
        </div>
    );
});

export default ChartList;
