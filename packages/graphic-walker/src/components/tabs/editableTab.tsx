import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import Modal from "../modal";
import { unstable_batchedUpdates } from "react-dom";
import DefaultButton from "../button/default";
import PrimaryButton from "../button/primary";

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

export interface ITabOption {
    label: string;
    key: string;
    editable?: boolean;
}
interface EditableTabsProps {
    tabs: ITabOption[];
    selectedKey: string;
    onSelected: (selectedKey: string, index: number) => void;
    onEditLabel?: (label: string, index: number) => void;
}
export default function EditableTabs(props: EditableTabsProps) {
    const { tabs, selectedKey, onSelected, onEditLabel } = props;
    const [editingIndex, setEditingIndex] = useState<number>(-1);
    const [name, setName] = useState<string>("");
    const { t } = useTranslation();

    return (
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden">
            <Modal
                show={editingIndex > -1}
                onClose={() => {
                    setEditingIndex(-1);
                }}
            >
                <div>
                    <span className="block text-sm font-medium leading-6">{t('main.tablist.chart_name')}</span>
                    <div className="mt-2">
                        <input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                            }}
                            type="text"
                            name="text"
                            className="block w-full rounded-md border-0 px-2 py-1.5 bg-transparent shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <DefaultButton
                            className="mr-2"
                            text={t("actions.cancel")}
                            onClick={() => {
                                unstable_batchedUpdates(() => {
                                    setEditingIndex(-1);
                                    setName("");
                                });
                            }}
                        />
                        <PrimaryButton
                            text={t("actions.confirm")}
                            onClick={() => {
                                unstable_batchedUpdates(() => {
                                    onEditLabel && onEditLabel(name, editingIndex);
                                    setEditingIndex(-1);
                                    setName("");
                                });
                            }}
                        />
                    </div>
                </div>
            </Modal>
            <nav className="-mb-px flex h-8 border-gray-200 dark:border-gray-700" role="tablist" aria-label="Tabs">
                {tabs.map((tab, tabIndex) => (
                    <span
                        role="tab"
                        tabIndex={0}
                        // dangerouslySetInnerHTML={{
                        //     __html: tab.label
                        // }}
                        onClick={() => {
                            onSelected(tab.key, tabIndex);
                        }}
                        key={tab.key}
                        className={classNames(
                            tab.key === selectedKey
                                ? "border rounded-t"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-50 dark:hover:text-gray-200 dark:hover:bg-gray-800",
                            "whitespace-nowrap border-gray-200 dark:border-gray-700 py-1 px-2 pr-6 text-sm cursor-default dark:text-white"
                        )}
                    >
                        {tab.label}{" "}
                        {tab.key === selectedKey && tab.editable && (
                            <PencilSquareIcon
                                className="w-3 inline cursor-pointer"
                                onClick={() => {
                                    unstable_batchedUpdates(() => {
                                        setEditingIndex(tabIndex);
                                        setName(tab.label);
                                    });
                                }}
                            />
                        )}
                    </span>
                ))}
            </nav>
        </div>
    );
}
