import { IThemeKey } from "../interfaces";
import { builtInThemes } from "../vis/theme";

export function useTheme (props: { themeKey?: IThemeKey; themeConfig?: any; mediaTheme: 'dark' | 'light' }) {
    const { themeConfig, themeKey, mediaTheme } = props;
    const config = (themeConfig ?? builtInThemes[themeKey ?? 'vega'])?.[mediaTheme];
    return config
}