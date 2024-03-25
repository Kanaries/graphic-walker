import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface IDropdownSelectOption<T extends string = string> {
    label: React.ReactNode;
    value: T;
}
export interface IDropdownSelectProps<T extends string> {
    options?: IDropdownSelectOption<T>[];
    disable?: boolean;
    selectedKey: T;
    onSelect?: (value: T) => void;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}
const DropdownSelect = function <T extends string>(props: IDropdownSelectProps<T>) {
    const { options = [], disable, selectedKey, onSelect, placeholder = 'Select an option', className } = props;
    return (
        <Select
            disabled={disable}
            value={selectedKey}
            onValueChange={(newKey) => {
                if (newKey === '_none') {
                    onSelect?.('' as T);
                } else {
                    onSelect?.(newKey as T);
                }
            }}
        >
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                        {op.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default DropdownSelect;
