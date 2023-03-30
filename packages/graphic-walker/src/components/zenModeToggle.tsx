import React from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { useGlobalStore } from '../store';


export interface IZenModeToggleProps {
    className?: string;
}

const ZenModeToggle = observer<IZenModeToggleProps>(function ZenModeToggle({ className = '' }) {
    const { commonStore } = useGlobalStore();
    const { zenMode } = commonStore;

    const Icon = zenMode ? ArrowsPointingInIcon : ArrowsPointingOutIcon;

    return (
        <div
            role="button"
            tabIndex={-1}
            className={`flex items-center justify-center p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 ${className}`}
            onClick={() => commonStore.toggleZenMode(!zenMode)}
        >
            <Icon className="w-6 h-6" />
        </div>
    );
});


export default ZenModeToggle;
