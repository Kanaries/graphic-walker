import { createContext, useContext } from 'react';

export const themeContext = createContext<{
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
}>({
    theme: 'light',
    setTheme: () => {},
});

export const useTheme = () => useContext(themeContext);
