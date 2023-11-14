import React from 'react';

export const Errors = {
    canvasExceedSize: 500,
    computationError: 501,
    askVizError: 502
} as const;

export const errorContext = React.createContext({
    reportError: (() => {}) as (message: string, code: (typeof Errors)[keyof typeof Errors]) => void,
});

export const useReporter = () => React.useContext(errorContext);

export const ErrorContext = errorContext.Provider;