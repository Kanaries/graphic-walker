import { IThemeKey } from '../interfaces';
import { builtInThemes, getColorPalette, getPrimaryColor } from '../vis/theme';

type PlainObject = { [key: string]: any };

const isPlainObject = (obj: any): obj is PlainObject => {
    return obj && typeof obj === 'object' && obj.constructor === Object;
};

const clone = <T>(a: T): T => {
    if (Array.isArray(a)) {
        return a.map(clone) as any;
    } else if (isPlainObject(a)) {
        return { ...a };
    }
    return a;
};

const deepMerge = (a: PlainObject, b: PlainObject): PlainObject => {
    if (isPlainObject(a) && isPlainObject(b)) {
        const result = { ...a };
        Object.keys(b).forEach((key) => {
            result[key] = isPlainObject(result[key]) ? deepMerge(result[key], b[key]) : b[key];
        });
        return result;
    }
    return b;
};

const deepMergeAll = (...objects: PlainObject[]): PlainObject => {
    return objects.reduce((acc, obj) => deepMerge(acc, obj), {});
};

export function getTheme(props: { themeKey?: IThemeKey; themeConfig?: any; primaryColor?: string; colorPalette?: string; mediaTheme: 'dark' | 'light' }) {
    const { themeConfig, themeKey, mediaTheme, colorPalette, primaryColor } = props;
    const presetConfig = themeConfig ?? builtInThemes[themeKey ?? 'vega'];
    const colorConfig = primaryColor ? getPrimaryColor(primaryColor) : {};
    const paletteConfig = colorPalette ? getColorPalette(colorPalette) : {};
    const config = deepMergeAll(presetConfig, colorConfig, paletteConfig)?.[mediaTheme];
    return config;
}
