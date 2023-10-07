import React from 'react';

export function ConfigItemContainer (props: { children?: React.ReactNode; className?: string }) {
    return <div className="border border-gray-200 dark:border-gray-700 p-4 m-4 rounded-lg">
        {props.children}
    </div>
}

export function ConfigItemContent (props: { children?: React.ReactNode }) {
    return <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
        {props.children}
    </div>
}

export function ConfigItemHeader (props: { children?: React.ReactNode }) {
    return <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
        {props.children}
    </div>
}

export function ConfigItemTitle (props: { children?: React.ReactNode }) {
    return <h2 className="text-xl text-gray-800 dark:text-gray-50 font-medium">
        {props.children}
    </h2>
}