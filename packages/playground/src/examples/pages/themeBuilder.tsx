import { useMemo, useState } from 'react';
import { GraphicWalker, IChart, IUIThemeConfig, getPaletteFromColor } from '@kanaries/graphic-walker';
import { IDataSource, extractHSL, extractRGB, toHex, useFetch } from '../util';
import { Picker } from '../components/colorPicker';
import spec from '../specs/student-chart.json';
import React from 'react';
import rgb from 'color-space/rgb.js';
import hsl from 'color-space/hsl.js';

const chart = [spec[0] as IChart];

function reversedColor(hex: string) {
    const { r, g, b } = extractRGB(hex);
    const [h, s, l] = rgb.hsl([r, g, b]);
    return toHex(...((hsl.rgb([h, s, 100 - l]) as number[]).map((x) => Math.floor(x)) as [number, number, number]));
}

function HSLToHex(hslStr: string) {
    const { h, s, l } = extractHSL(hslStr);
    const [r, g, b] = hsl.rgb([h, s, l]);
    return toHex(Math.floor(r), Math.floor(g), Math.floor(b));
}

function ThemeBuilder() {
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const [background, setBackground] = useState('#ffffff');
    const [darkBackground, setDarkBackground] = useState('#18181b');
    const [neutral, setNetrual] = useState('#18181b');
    const [primary, setPrimary] = useState('');
    const [secondary, setSecondary] = useState('');
    const [destructive, setDestructive] = useState('');
    const [dimension, setDimension] = useState('');
    const [measure, setMeasure] = useState('');
    const uiTheme = useMemo((): IUIThemeConfig => {
        const neutralColors = getPaletteFromColor(neutral);
        const destructiveColors = destructive ? getPaletteFromColor(destructive) : null;
        return {
            light: {
                background,
                foreground: HSLToHex(neutralColors[950]),
                primary: primary || HSLToHex(neutralColors[900]),
                'primary-foreground': HSLToHex(neutralColors[50]),
                ...(secondary ? { secondary, 'secondary-foreground': HSLToHex(neutralColors[900]) } : {}),
                muted: HSLToHex(neutralColors[100]),
                'muted-foreground': HSLToHex(neutralColors[500]),
                'accent-foreground': HSLToHex(neutralColors[900]),
                border: HSLToHex(neutralColors[200]),
                ring: HSLToHex(neutralColors[950]),
                ...(destructive ? { 'destructive-foreground': HSLToHex(destructiveColors![50]), destructive } : {}),
                ...(dimension ? { dimension } : {}),
                ...(measure ? { measure } : {}),
            },
            dark: {
                background: darkBackground,
                foreground: HSLToHex(neutralColors[50]),
                primary: primary ? reversedColor(primary) : HSLToHex(neutralColors[50]),
                'primary-foreground': HSLToHex(neutralColors[900]),
                ...(secondary ? { secondary: reversedColor(secondary), 'secondary-foreground': HSLToHex(neutralColors[50]) } : {}),
                muted: HSLToHex(neutralColors[800]),
                'muted-foreground': HSLToHex(neutralColors[400]),
                'accent-foreground': HSLToHex(neutralColors[50]),
                border: HSLToHex(neutralColors[800]),
                ring: HSLToHex(neutralColors[300]),
                ...(destructive ? { 'destructive-foreground': HSLToHex(destructiveColors![50]), destructive: reversedColor(destructive) } : {}),
                ...(dimension ? { dimension: reversedColor(dimension) } : {}),
                ...(measure ? { measure: reversedColor(measure) } : {}),
            },
        };
    }, [background, darkBackground, neutral, primary, secondary, destructive, dimension, measure]);

    return (
        <div className="p-4 relative text-gray-900 dark:text-white">
            <div className="flex">
                <div className="grid grid-cols-[minmax(0,1fr)_14px_32px] gap-2 p-4 ">
                    <div>
                        <div>Background</div>
                        <div className="text-xs text-gray-500">The background color.</div>
                    </div>
                    <div />
                    <Picker value={background} onChange={setBackground} />
                    <div>
                        <div>DarkBackground</div>
                        <div className="text-xs text-gray-500">The background color in dark mode.</div>
                    </div>
                    <div />
                    <Picker value={darkBackground} onChange={setDarkBackground} />
                    <div>
                        <div>Neutral</div>
                        <div className="text-xs text-gray-500">The base color, used for texts.</div>
                    </div>
                    <div />
                    <Picker value={neutral} onChange={setNetrual} />
                    <div>
                        <div>Primary</div>
                        <div className="text-xs text-gray-500">Used for primary buttons and items.</div>
                    </div>
                    <div>
                        <input type="checkbox" checked={!!primary} onChange={(e) => (e.target.checked ? setPrimary(neutral) : setPrimary(''))} />
                    </div>
                    <Picker value={primary || neutral} onChange={setPrimary} />
                    <div>
                        <div>Secondary</div>
                        <div className="text-xs text-gray-500">Used for background and texts of tables headers.</div>
                    </div>
                    <div>
                        <input type="checkbox" checked={!!secondary} onChange={(e) => (e.target.checked ? setSecondary(neutral) : setSecondary(''))} />
                    </div>
                    <Picker value={secondary || neutral} onChange={setSecondary} />
                    <div>
                        <div>Destructive</div>
                        <div className="text-xs text-gray-500">Used for delete buttons.</div>
                    </div>
                    <div>
                        <input type="checkbox" checked={!!destructive} onChange={(e) => (e.target.checked ? setDestructive('#ef4444') : setDestructive(''))} />
                    </div>
                    <Picker value={destructive || '#ef4444'} onChange={setDestructive} />
                    <div>
                        <div>Dimension</div>
                        <div className="text-xs text-gray-500">Used for dimension fields.</div>
                    </div>
                    <div>
                        <input type="checkbox" checked={!!dimension} onChange={(e) => (e.target.checked ? setDimension('#3b82f6') : setDimension(''))} />
                    </div>
                    <Picker value={dimension || '#3b82f6'} onChange={setDimension} />
                    <div>
                        <div>Measure</div>
                        <div className="text-xs text-gray-500">Used for measure fields.</div>
                    </div>
                    <div>
                        <input type="checkbox" checked={!!measure} onChange={(e) => (e.target.checked ? setMeasure('#a855f7') : setMeasure(''))} />
                    </div>
                    <Picker value={measure || '#a855f7'} onChange={setMeasure} />
                </div>
                <div className="flex-1 flex flex-col pb-2">
                    <div className="pb-2 flex justify-between">
                        <div>Code</div>
                        <button
                            className="px-2 py-1 text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md"
                            onClick={() => {
                                navigator.clipboard
                                    .writeText(`const uiTheme = ${JSON.stringify(uiTheme, undefined, 2)};`)
                                    .then(() => {
                                        alert('Code copied to clipboard');
                                    })
                                    .catch(() => {
                                        alert('Failed to copy code');
                                    });
                            }}
                        >
                            Copy
                        </button>
                    </div>
                    <textarea className="border p-2 flex-1 rounded" value={`const uiTheme = ${JSON.stringify(uiTheme, undefined, 2)};`} />
                </div>
            </div>
            <div className="flex w-full border-t pt-2">
                <div className="flex-1 overflow-auto">
                    <GraphicWalker rawFields={fields} dataSource={dataSource} dark="light" chart={chart} uiTheme={uiTheme} />
                </div>
                <div className="w-px h-full bg-gray-500"></div>
                <div className="dark flex-1 overflow-auto">
                    <GraphicWalker rawFields={fields} dataSource={dataSource} dark="dark" chart={chart} uiTheme={uiTheme} />
                </div>
            </div>
        </div>
    );
}

export default function ThemeBuilderPage() {
    return (
        <React.Suspense fallback={<p>Loading component...</p>}>
            <ThemeBuilder />
        </React.Suspense>
    );
}
