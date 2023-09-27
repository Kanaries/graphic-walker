import { IThemeKey } from '../interfaces';
import { builtInThemes, getColorPalette, getPrimaryColor } from '../vis/theme';

const isPlainObject = (a): a is object => typeof a === 'object' && !(a instanceof Array);

const clone = <T>(a: T) => {
    if (isPlainObject(a)) {
        if (a === null) return a;
        return Object.fromEntries(Object.keys(a).map((k) => [k, clone(a[k])]));
    }
    return a;
};

const merge = (a: any, b: any) => {
    if (isPlainObject(a) && isPlainObject(b)) {
        const result = clone(a);
        Object.keys(b).forEach((k) => {
            result[k] = merge(result[k], b[k]);
        });
        return result;
    }
    return b;
};

const merge2 = (...a: any[]) => {
    if (a.length === 0) return undefined;
    if (a.length === 1) return a[0];
    let result = merge(a[0], a[1]);
    for (let i = 2; i < a.length; i++) {
        result = merge(result, a[i]);
    }
    return result;
};

export function getTheme(props: { themeKey?: IThemeKey; themeConfig?: any; primaryColor?: string; colorPalette?: string; mediaTheme: 'dark' | 'light' }) {
    const { themeConfig, themeKey, mediaTheme, colorPalette, primaryColor } = props;
    const presetConfig = themeConfig ?? builtInThemes[themeKey ?? 'vega'];
    const colorConfig = primaryColor ? getPrimaryColor(primaryColor) : {};
    const paletteConfig = colorPalette ? getColorPalette(colorPalette) : {};
    const config = merge2(presetConfig, colorConfig, paletteConfig)?.[mediaTheme];
    return config;
}
