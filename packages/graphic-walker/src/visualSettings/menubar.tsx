import React from 'react';

export const useShortcut = (shortcut: string, handler: () => void) => {
    const rule = React.useMemo(() => {
        const keys = shortcut.split('+').map((d) => d.trim());

        return {
            key: keys.filter((d) => /^[a-z]$/i.test(d))[0],
            ctrlKey: keys.includes('Ctrl'),
            shiftKey: keys.includes('Shift'),
            altKey: keys.includes('Alt'),
        };
    }, [shortcut]);

    React.useEffect(() => {
        const cb = (ev: KeyboardEvent) => {
            if (ev.ctrlKey === rule.ctrlKey && ev.shiftKey === rule.shiftKey && ev.altKey === rule.altKey && ev.key.toLowerCase() === rule.key.toLowerCase()) {
                handler();
                ev.stopPropagation();
            }
        };

        document.body.addEventListener('keydown', cb);

        return () => document.body.removeEventListener('keydown', cb);
    }, [rule, handler]);
};
