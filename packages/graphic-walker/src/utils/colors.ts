import { IUIThemeConfig, IColorPalette, IColorSet } from '../interfaces';
import colorString from 'color-string';
import rgb from 'color-space/rgb.js';
import hsl from 'color-space/hsl.js';
import hwb from 'color-space/hwb.js';
import colors from 'tailwindcss/colors';

function parseColorString(color: string) {
    const trySplit = color.split('-');
    if (trySplit.length === 2) {
        const [name, shade] = trySplit;
        if (colors[name] && colors[name][shade]) {
            return colorString.get(colors[name][shade]);
        }
    }
    return colorString.get(color);
}

function toHSL(color: string): [number, number, number, number] {
    const item = parseColorString(color);
    if (item) {
        if (item.model === 'hsl') {
            return item.value;
        }
        if (item.model === 'rgb') {
            return rgb.hsl(item.value);
        }
        if (item.model === 'hwb') {
            return hwb.hsl(item.value);
        }
    }
    throw new Error(`cannot parse color ${color}`);
}

export function parseColorToHSL(color: string) {
    const [h, s, l] = toHSL(color);
    return `${h} ${s}% ${l}%`;
}

export function parseColorToHex(color: string) {
    return colorString.to.hex(hsl.rgb(toHSL(color)));
}

function ColorSetToCss(set: Required<IColorSet>) {
    return Object.entries(set)
        .map(([name, value]) => `--${name}:${parseColorToHSL(value)};`)
        .join('');
}

const baseTheme = {
    light: {
        destructive: 'hsl(0 84.2% 60.2%)',
        'destructive-foreground': 'hsl(0 0% 98%)',
        dimension: 'hsl(217.2 91.2% 59.8%)',
        measure: 'hsl(270.7 91% 65.1%)',
    },
    dark: {
        destructive: 'hsl(0 62.8% 30.6%)',
        'destructive-foreground': 'hsl(0 0% 98%)',
        dimension: 'hsl(213.1 93.9% 67.8%)',
        measure: 'hsl(270 95.2% 75.3%)',
    },
};

function fillColorConfig(config: IColorSet, baseColors: (typeof baseTheme)['light']): Required<IColorSet> {
    return {
        ...baseColors,
        ...{
            card: config.background,
            'card-foreground': config.foreground,
            popover: config.background,
            'popover-foreground': config.foreground,
            secondary: config.muted,
            'secondary-foreground': config.primary,
            accent: config.muted,
            'accent-foreground': config.primary,
            input: config.border,
        },
        ...config,
    };
}

export function ColorConfigToCSS(config: IUIThemeConfig) {
    return `:host{${ColorSetToCss(fillColorConfig(config.light, baseTheme.light))}}\n.dark{${ColorSetToCss(fillColorConfig(config.dark, baseTheme.dark))}}`;
}

export function getColorConfigFromPalette(colors: IColorPalette): IUIThemeConfig {
    return {
        light: {
            background: 'white',
            foreground: colors[950],
            primary: colors[900],
            'primary-foreground': colors[50],
            muted: colors[100],
            'muted-foreground': colors[500],
            border: colors[200],
            ring: colors[950],
        },
        dark: {
            background: colors[950],
            foreground: colors[50],
            primary: colors[50],
            'primary-foreground': colors[900],
            muted: colors[800],
            'muted-foreground': colors[400],
            border: colors[800],
            ring: colors[300],
        },
    };
}

const shades = [98, 95, 90, 82, 64, 46, 33, 24, 14, 7, 4];

export function getPaletteFromColor(color: string): IColorPalette {
    const [h, s, l] = toHSL(color);
    const lightOffset = shades.map((baseL) => l - baseL).reduce((a, b) => (Math.abs(a) > Math.abs(b) ? b : a), Infinity);
    const minimax = (val: number) => Math.min(100, Math.max(0, val));
    return {
        '50': `hsl(${h} ${s}% ${minimax(98 + lightOffset)}%)`,
        '100': `hsl(${h} ${s}% ${minimax(95 + lightOffset)}%)`,
        '200': `hsl(${h} ${s}% ${minimax(90 + lightOffset)}%)`,
        '300': `hsl(${h} ${s}% ${minimax(82 + lightOffset)}%)`,
        '400': `hsl(${h} ${s}% ${minimax(64 + lightOffset)}%)`,
        '500': `hsl(${h} ${s}% ${minimax(46 + lightOffset)}%)`,
        '800': `hsl(${h} ${s}% ${minimax(14 + lightOffset)}%)`,
        '900': `hsl(${h} ${s}% ${minimax(7 + lightOffset)}%)`,
        '950': `hsl(${h} ${s}% ${minimax(4 + lightOffset)}%)`,
    };
}

export const zincTheme: IUIThemeConfig = getColorConfigFromPalette(colors.zinc);
export const slateTheme: IUIThemeConfig = getColorConfigFromPalette(colors.slate);
export const grayTheme: IUIThemeConfig = getColorConfigFromPalette(colors.gray);
export const neutralTheme: IUIThemeConfig = getColorConfigFromPalette(colors.neutral);
export const stoneTheme: IUIThemeConfig = getColorConfigFromPalette(colors.stone);
