import { createContext } from 'react';
import { IUIThemeConfig, IThemeKey } from '../interfaces';
import { GWGlobalConfig } from '../vis/theme';
import { zincTheme } from '../utils/colors';

export const themeContext = createContext<'light' | 'dark'>('light');

export const vegaThemeContext = createContext<{
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
}>({});

export const portalContainerContext = createContext<HTMLDivElement | null>(null);

/**
 * for portal shadow doms
 */
export const uiThemeContext = createContext<IUIThemeConfig>(zincTheme);
