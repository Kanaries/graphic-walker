import React, { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";

export interface IDropdownSelectOption {
    label: string;
    value: string;
    disabled?: boolean;
}
interface IDropdownSelectProps {
    options?: IDropdownSelectOption[];
    disable?: boolean;
    selectedKey: string;
    onSelect?: (value: string) => void;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
}
const DropdownSelect: React.FC<IDropdownSelectProps> = (props) => {
    const { options = [], disable, selectedKey, onSelect, placeholder = "Select an option", className, buttonClassName } = props;

    const selectedItem = options.find((op) => op.value === selectedKey);

    if (disable) {
        return <Fragment>{props.children}</Fragment>;
    }
    let rootClassName = "flex truncate";
    let btnComputedClassName = "grow shrink relative cursor-default text-xs rounded-lg bg-white dark:bg-zinc-900  px-2.5 py-1.5 pr-10 text-left border border-gray-200 focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 truncate"
    if (buttonClassName) {
        btnComputedClassName = btnComputedClassName + " " + buttonClassName;
    }
    if (className) {
        rootClassName = rootClassName + " " + className;
    }
    return (
        <Listbox
            value={selectedKey}
            onChange={(newKey) => {
                onSelect && onSelect(newKey);
            }}
        >
            <div className={rootClassName}>
                <Listbox.Button className={btnComputedClassName}>
                    <span className="block truncate">{selectedItem?.label || ""}</span>
                    { selectedItem === undefined && <span className="block truncate text-gray-400">{placeholder}</span>}
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span>
                </Listbox.Button>
                <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <Listbox.Options className="absolute z-50 mt-8 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-zinc-900  py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {options.map((op, opIndex) => (
                            <Listbox.Option
                                key={op.value}
                                className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                        active ? "bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-50" : "text-gray-900 dark:text-amber-50"
                                    }`
                                }
                                value={op.value}
                            >
                                {({ selected }) => (
                                    <>
                                        <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                            {op.label}
                                        </span>
                                        {selected && (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                        )}
                                    </>
                                )}
                            </Listbox.Option>
                        ))}
                    </Listbox.Options>
                </Transition>
            </div>
        </Listbox>
    );
};

export default DropdownSelect;
