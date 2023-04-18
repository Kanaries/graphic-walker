import React, { Fragment, useEffect, useRef, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";


export interface ISelectContextOption {
    key: string;
    label: string;
    disabled?: boolean;
}
interface ISelectContextProps {
    options?: ISelectContextOption[];
    disable?: boolean;
    selectedKeys?: string[];
    onSelect?: (selectedKeys: string[]) => void;
}
const SelectContext: React.FC<ISelectContextProps> = (props) => {
    const { options = [], disable = false, selectedKeys = [], onSelect } = props;

    const [selected, setSelected] = useState<ISelectContextOption[]>(options.filter(opt => selectedKeys.includes(opt.key)));

    useEffect(() => {
        setSelected(options.filter(opt => selectedKeys.includes(opt.key)));
    }, [options, selectedKeys]);

    const selectedKeysRef = useRef(selectedKeys);
    selectedKeysRef.current = selectedKeys;

    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    useEffect(() => {
        const keys = selected.map(opt => opt.key);
        if (keys.length !== selectedKeysRef.current.length || keys.some(key => !selectedKeysRef.current.includes(key))) {
            onSelectRef.current?.(keys);
        }
    }, [selected]);

    if (disable) {
        return <Fragment>{props.children}</Fragment>;
    }

    return (
        <Listbox multiple value={selected} onChange={setSelected}>
            <div className="relative">
                <Listbox.Button className="relative w-full flex items-center space-x-2">
                    <span className="flex-1 block truncate">
                        {props.children}
                    </span>
                    <span className="pointer-events-none grow-0 shrink-0 flex items-center pr-2">
                        <Cog6ToothIcon
                            className="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                        />
                    </span>
                </Listbox.Button>
                <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <Listbox.Options className="absolute mt-1 max-h-60 min-w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {options.map(option => (
                            <Listbox.Option
                                key={option.key}
                                className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-amber-100 text-amber-900' : 'text-gray-900'}`
                                }
                                value={option}
                            >
                                {({ selected }) => (
                                    <>
                                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                            {option.label}
                                        </span>
                                        {selected ? (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                        ) : null}
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

export default SelectContext;
