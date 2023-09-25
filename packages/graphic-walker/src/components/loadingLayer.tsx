import React from 'react';
import Spinner from './spinner';

export default function LoadingLayer () {
    return <div className="bg-gray-100/50 dark:bg-gray-700/50 absolute top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center">
        <Spinner className="text-indigo-500" />
        <span className="text-sm text-indigo-500">
            Loading...
        </span>
    </div>
}