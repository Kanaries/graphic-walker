import React, { Fragment, useEffect, useRef, useState, useContext, useMemo } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { Float } from '@headlessui-float/react';
import { blockContext } from '../../fields/fieldsContext';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

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
    children?: React.ReactNode | Iterable<React.ReactNode>;
}
const SelectContext: React.FC<ISelectContextProps> = (props) => {
    const { options = [], disable = false, selectedKeys = [], onSelect, className = '', required } = props;

    const [selected, setSelected] = useState<ISelectContextOption[]>(options.filter((opt) => selectedKeys.includes(opt.key)));

    useEffect(() => {
        setSelected(options.filter((opt) => selectedKeys.includes(opt.key)));
    }, [options, selectedKeys]);

    const selectedKeysRef = useRef(selectedKeys);
    selectedKeysRef.current = selectedKeys;

    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    useEffect(() => {
        const keys = selected.map((opt) => opt.key);
        if (keys.length !== selectedKeysRef.current.length || keys.some((key) => !selectedKeysRef.current.includes(key))) {
            onSelectRef.current?.(keys);
        }
    }, [selected]);

    if (disable) {
        return <Fragment>{props.children}</Fragment>;
    }

    return (
        <Popover>
            <div className="relative w-full flex items-center space-x-2">
                <span className="flex-1 block truncate text-start">{props.children}</span>
                <PopoverTrigger asChild>
                    <div className="grow-0 shrink-0 flex items-center relative">
                        <Cog6ToothIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {selected.length > 0 && (
                            <span className="absolute top-0 right-0 h-4 px-1 translate-x-1/2 -translate-y-1/2 scale-[67%] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-normal pointer-events-none">
                                {selected.length > 10 ? '10+' : selected.length}
                            </span>
                        )}
                    </div>
                </PopoverTrigger>
            </div>
            <PopoverContent className="mt-1 max-h-60 w-fit overflow-auto rounded-md py-1 px-0 text-base sm:text-sm">
                <Listbox multiple value={selected} onChange={setSelected}>
                    <Listbox.Options static>
                        {options.map((option) => (
                            <Listbox.Option
                                key={option.key}
                                className={`relative cursor-default rounded-md mx-1 select-none py-2 pl-10 pr-4 text-popover-foreground hover:bg-accent hover:text-accent-foreground`}
                                value={option}
                            >
                                {({ selected }) => (
                                    <>
                                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>{option.label}</span>
                                        {selected && (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-accent-foreground">
                                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                        )}
                                    </>
                                )}
                            </Listbox.Option>
                        ))}
                    </Listbox.Options>
                </Listbox>
            </PopoverContent>
        </Popover>
    );
};

export default SelectContext;
