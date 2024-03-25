import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/utils';
import { Button } from '../ui/button';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '../ui/command';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { ScrollArea } from '../ui/scroll-area';
import React from 'react';
import { IDropdownSelectOption, IDropdownSelectProps } from '.';

function Combobox<T extends string>({
    options = [],
    selectedKey: value,
    onSelect,
    className,
    popClassName,
    placeholder = 'Select A Value',
}: IDropdownSelectProps<T> & { popClassName?: string }) {
    const [open, setOpen] = useState(false);

    const selectedKey = value || '_none';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className={cn('flex justify-between', className)}>
                    <div className="shrink min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {options.find((opt) => opt.value === selectedKey)?.label ?? placeholder}
                    </div>
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn('p-0', popClassName)}>
                <Command>
                    <CommandInput placeholder="Search..." className="h-9" />
                    <CommandEmpty>No options found.</CommandEmpty>
                    <ScrollArea className="h-min max-h-48">
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.value}
                                    onSelect={() => {
                                        if (opt.value === '_none') {
                                            onSelect?.('' as T);
                                        } else {
                                            onSelect?.(opt.value === selectedKey ? '' as T : opt.value);
                                        }
                                        setOpen(false);
                                    }}
                                >
                                    {opt.label}
                                    <CheckIcon className={cn('ml-auto h-4 w-4', selectedKey === opt.value ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </ScrollArea>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function MultiCombobox({
    options = [],
    selectedKeys,
    onSelect,
    className,
    popClassName,
    placeholder = 'Select A Value',
}: {
    options?: IDropdownSelectOption[];
    disable?: boolean;
    selectedKeys: string[];
    onSelect?: (value: string[]) => void;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    popClassName?: string;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className={cn('flex justify-between', className)}>
                    <div className="shrink min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {options
                            .filter((opt) => selectedKeys.includes(opt.value))
                            .map((x) => x.label)
                            .join(',') || placeholder}
                    </div>
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn('p-0', popClassName)}>
                <Command>
                    <CommandInput placeholder="Search..." className="h-9" />
                    <CommandEmpty>No options found.</CommandEmpty>
                    <ScrollArea className="h-min max-h-48">
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.value}
                                    onSelect={(currentValue) => {
                                        onSelect?.(
                                            selectedKeys.includes(opt.value) ? selectedKeys.filter((k) => k !== opt.value) : selectedKeys.concat(opt.value)
                                        );
                                        setOpen(false);
                                    }}
                                >
                                    {opt.label}
                                    <CheckIcon className={cn('ml-auto h-4 w-4', selectedKeys.includes(opt.value) ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </ScrollArea>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default Combobox;
