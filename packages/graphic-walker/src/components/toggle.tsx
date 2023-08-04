import React, { useState } from 'react';
import { Switch } from '@headlessui/react';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

interface ToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label?: string;
}

export default function Toggle(props: ToggleProps) {
    const { enabled, onChange, label } = props;

    return (
        <Switch.Group as="div" className="flex items-center">
            <Switch
                checked={enabled}
                onChange={onChange}
                className={classNames(
                    enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2'
                )}
            >
                <span
                    aria-hidden="true"
                    className={classNames(
                        enabled ? 'translate-x-5' : 'translate-x-0',
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                />
            </Switch>
            <Switch.Label as="span" className="ml-3 text-sm">
                <span className="font-medium">{label}</span>
            </Switch.Label>
        </Switch.Group>
    );
}
