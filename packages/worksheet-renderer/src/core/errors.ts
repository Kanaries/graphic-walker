import type { Diagnostic } from './types';

/** Contract failures are explicit so hosts can show a capability or data diagnostic. */
export class PreparedDataError extends Error {
    readonly diagnostic: Diagnostic;
    readonly code: string;
    constructor(code: string, message: string, fieldRef?: string) {
        super(message);
        this.name = 'PreparedDataError';
        this.code = code;
        this.diagnostic = { code, message, fieldRef, severity: 'error', recoverable: false };
    }
}

