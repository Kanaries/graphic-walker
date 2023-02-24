import React, { ReactElement } from "react";

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ')
}

export interface ITabOption {
    label: string | ReactElement;
    key: string;
}
interface DefaultProps {
    tabs: ITabOption[];
    selectedKey: string;
    onSelected: (selectedKey: string, index: number) => void;
    allowEdit?: boolean;
    onEditLabel?: (label: string, index: number) => void;
}
export default function Default(props: DefaultProps) {
    const { tabs, selectedKey, onSelected } = props;

    return (
        <div className="border-b border-gray-200 mb-2" >
            <nav className="-mb-px flex space-x-8" role="tablist" aria-label="Tabs">
                {tabs.map((tab, tabIndex) => (
                    <span
                        role="tab"
                        tabIndex={0}
                        onClick={() => {
                            onSelected(tab.key, tabIndex)
                        }}
                        key={tab.key}
                        className={classNames(
                            tab.key === selectedKey
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                          'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                        )}
                    >{tab.label}</span>
                ))}
            </nav>
        </div>
    );
}
