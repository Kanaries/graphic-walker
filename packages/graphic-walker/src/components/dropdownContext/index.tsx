import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export interface IDropdownContextOption {
    label: string;
    value: string;
    disabled?: boolean;
}
interface IDropdownContextProps {
    options?: IDropdownContextOption[];
    disable?: boolean;
    onSelect?: (value: string, index: number) => void;
    position?: 'center' | 'end' | 'start';
    children?: React.ReactNode | Iterable<React.ReactNode>;
}
const DropdownContext: React.FC<IDropdownContextProps> = (props) => {
    const { options = [], disable, position = 'start' } = props;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger disabled={disable} asChild>
                {props.children}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={position}>
                {options.map((option, index) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => {
                            props.onSelect && !props.disable && props.onSelect(option.value, index);
                        }}
                    >
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default DropdownContext;
