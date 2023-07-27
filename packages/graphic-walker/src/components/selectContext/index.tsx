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
    className?: string;
    required?: boolean;
}
const SelectContext: React.FC<ISelectContextProps> = (props) => {
    const { options = [], disable = false, selectedKeys = [], onSelect, className = '', required } = props;

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
            <div className={`relative ${className}`}>
                <div className="relative w-full flex items-center space-x-2">
                    <span className="flex-1 block truncate text-start">
                        {props.children}
                    </span>
                    <Listbox.Button className="grow-0 shrink-0 flex items-center relative">
                        <Cog6ToothIcon
                            className="h-4 w-4 text-gray-400"
                            aria-hidden="true"
                        />
                        {required && selected.length === 0 && (
                            <span className="absolute top-0 right-0 h-1.5 w-1.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500 pointer-events-none" aria-hidden />
                        )}
                        {selected.length > 0 && (
                            <span className="absolute top-0 right-0 h-4 px-1 translate-x-1/2 -translate-y-1/2 scale-[67%] flex items-center justify-center rounded-full bg-indigo-400/75 text-white text-xs font-normal pointer-events-none">
                                {selected.length > 10 ? '10+' : selected.length}
                            </span>
                        )}
                    </Listbox.Button>
                </div>
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
