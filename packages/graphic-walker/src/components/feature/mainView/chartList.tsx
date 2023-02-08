import React from "react";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../../store";
import { useTranslation } from "react-i18next";

const ChartList = observer(function ChartList () {
    const { t } = useTranslation();
    const { vizStore, commonStore } = useGlobalStore();
    const { visIndex, visList } = vizStore;

    return (
        <div className="flex-1 w-full h-full overflow-auto p-2">
            <div className="flex flex-col items-stretch">
                {visList.map(page => (
                    <div key={page.visId}>
                        <span
                            dangerouslySetInnerHTML={{
                                __html: t(page.name?.[0] || 'vis', page.name?.[1]),
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});

export default ChartList;
