import { IThemeKey, VegaGlobalConfig } from '../interfaces';
import { DEFAULT_COLOR, builtInThemes, getColorPalette, getPrimaryColor } from '../vis/theme';
import { RangeScheme } from 'vega-typings';
import { PaletteName, getPalette } from '../components/visualConfig/colorScheme';

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

export function getTheme(props: { vizThemeConfig?: any; primaryColor?: string; colorPalette?: string; mediaTheme: 'dark' | 'light' }): VegaGlobalConfig {
    const { vizThemeConfig, mediaTheme, colorPalette, primaryColor } = props;
    const presetConfig = (typeof vizThemeConfig === 'string' ? builtInThemes[vizThemeConfig] : vizThemeConfig) ?? builtInThemes.vega;
    const colorConfig = primaryColor ? getPrimaryColor(primaryColor) : {};
    const paletteConfig = colorPalette ? getColorPalette(colorPalette) : {};
    const config = deepMergeAll(presetConfig, colorConfig, paletteConfig)?.[mediaTheme];
    return config;
}

function parsePalette(v?: RangeScheme): string[] | undefined {
    if (!v) {
        return undefined;
    }
    if (v instanceof Array) {
        return v as string[];
    }
    if (typeof v === 'object' && 'scheme' in v) {
        if (v.scheme instanceof Array) {
            return v.scheme;
        }
        return getPalette(v.scheme as PaletteName);
    }
    return undefined;
}

export function getColor(theme: VegaGlobalConfig) {
    const stroke = theme.point?.stroke ?? DEFAULT_COLOR;
    const primaryColor = typeof stroke === 'string' ? stroke : DEFAULT_COLOR;
    const nominalPalette = parsePalette(theme.range?.category) ?? getPalette('tableau10');
    const quantitativePalette = parsePalette(theme.range?.ramp) ?? getPalette('blues');
    return {
        primaryColor,
        nominalPalette,
        quantitativePalette,
    };
}
