import { useEffect, useState } from 'react';
import { IDarkMode } from '../interfaces';

export function currentMediaTheme(): 'dark' | 'light' {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    } else {
        return 'light';
    }
}

export function useCurrentMediaTheme(mode: IDarkMode | undefined = 'media'): 'dark' | 'light' {
    const [mediaTheme, setMediaTheme] = useState<'dark' | 'light'>(currentMediaTheme);

    useEffect(() => {
        const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') as MediaQueryList | undefined;
        const listener = (e: MediaQueryListEvent) => {
            setMediaTheme(e.matches ? 'dark' : 'light');
        };
        mediaQuery?.addEventListener('change', listener);
        return () => {
            mediaQuery?.removeEventListener('change', listener);
        };
    }, []);

    return mode === 'media' ? mediaTheme : mode;
}
