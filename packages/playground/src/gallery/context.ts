import { createContext, useContext } from 'react';

export const themeContext = createContext<{
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}>({
    theme: 'light',
    toggleTheme: () => {},
});

export const useTheme = () => useContext(themeContext);
