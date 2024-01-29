import { createContext } from 'react';
import { IThemeKey } from '../interfaces';
import { GWGlobalConfig } from '../vis/theme';

export const themeContext = createContext<'light' | 'dark'>('light');

export const vegaThemeContext = createContext<{
    themeKey?: IThemeKey;
    themeConfig?: GWGlobalConfig;
}>({});
