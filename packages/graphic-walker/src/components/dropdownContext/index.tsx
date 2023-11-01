import React, { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
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
    // left-0 right-0
    position?: string;
}
const DropdownContext: React.FC<IDropdownContextProps> = (props) => {
    const { options = [], disable, position = 'left-0' } = props;

    if (disable) {
        return <Fragment>{props.children}</Fragment>;
    }

    return (
        <Menu as="span" className="relative block text-left">
            <Menu.Button className="block w-full text-left">{props.children}</Menu.Button>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className={`absolute ${position} z-50 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-zinc-900  shadow-lg border border-gray-50 dark:border-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none`}>
                    <div className="py-1">
                        {options.map((option, index) => (
                            <Menu.Item key={option.value}>
                                {(p) => (
                                    <span
                                        className={classNames(
                                            p.active ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50" : "text-gray-700 dark:text-gray-200",
                                            "block px-4 py-2 text-sm"
                                        )}
                                        onClick={() => {
                                            props.onSelect && !props.disable && props.onSelect(option.value, index);
                                        }}
                                    >
                                    {option.label}
                                    </span>
                                )}
                            </Menu.Item>
                        ))}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
};

export default DropdownContext;
