import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import Tooltip from "../../tooltip";
import { DashboardSpecification } from "../../../store/dashboard/interfaces";
import { useDashboardContext } from "../../../store/dashboard";


export interface DashboardTitleProps {
    data: DashboardSpecification;
    idx: number;
    editingIdx: number;
    setEditingIdx: (idx: number) => void;
}

const DashboardTitle = observer<DashboardTitleProps>(function DashboardTitle ({ data, idx, editingIdx, setEditingIdx }) {
    const dashboard = useDashboardContext();
    const { dashboardIdx } = dashboard;

    const isCurPage = idx === dashboardIdx
    const editing = editingIdx === idx;

    const [inputName, setInputName] = useState('');

    const titleRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (titleRef.current && isCurPage) {
            titleRef.current.scrollIntoView({ block: 'nearest' });
        }
    }, [isCurPage]);

    return (
        <Tooltip
            at="right"
            distance={8}
            disabled={editing}
            overflowMode="children"
            content={data.title}
        >
            <div
                role="button"
                aria-selected={isCurPage}
                className="flex-grow-0 flex-shrink-0 py-1 px-1 cursor-pointer hover:bg-slate-100 aria-selected:bg-slate-200 flex items-center overflow-hidden"
                tabIndex={0}
                onClick={() => {
                    if (!isCurPage) {
                        dashboard.setPageIdx(idx);
                    }
                }}
                onDoubleClick={() => {
                    if (!editing) {
                        setEditingIdx(idx);
                        const originDisplayName = titleRef.current?.innerText;
                        setInputName(originDisplayName ?? '');
                    }
                }}
            >
                {editing ? (
                    <input
                        type="text"
                        className="flex-1 px-1 outline-none w-full"
                        autoFocus
                        value={inputName}
                        maxLength={32}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                            setInputName(e.target.value);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                dashboard.renamePage(idx, inputName);
                                setEditingIdx(-1);
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingIdx(-1);
                            }
                        }}
                    />
                ) : (
                    <span
                        ref={titleRef}
                        className="select-none px-1 truncate"
                    >
                        {data.title}
                    </span>
                )}
            </div>
        </Tooltip>
    );
});

export default DashboardTitle;
