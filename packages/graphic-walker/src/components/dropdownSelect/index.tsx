import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface IDropdownSelectOption {
    label: React.ReactNode;
    value: string;
}
export interface IDropdownSelectProps {
    options?: IDropdownSelectOption[];
    disable?: boolean;
    selectedKey: string;
    onSelect?: (value: string) => void;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}
const DropdownSelect: React.FC<IDropdownSelectProps> = (props) => {
    const { options = [], disable, selectedKey, onSelect, placeholder = 'Select an option', className } = props;
    return (
        <Select
            disabled={disable}
            value={selectedKey}
            onValueChange={(newKey) => {
                if (newKey === '_none') {
                    onSelect?.('');
                } else {
                    onSelect?.(newKey);
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
