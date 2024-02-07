import { createContext } from 'react';
import { IColorConfig, IThemeKey } from '../interfaces';
import { GWGlobalConfig } from '../vis/theme';
import { zincTheme } from '../utils/colors';

export const themeContext = createContext<'light' | 'dark'>('light');

export const vegaThemeContext = createContext<{
    themeKey?: IThemeKey;
    themeConfig?: GWGlobalConfig;
}>({});

export const portalContainerContext = createContext<HTMLDivElement | null>(null);

/**
 * for portal shadow doms
 */
export const colorContext = createContext<IColorConfig>(zincTheme);
