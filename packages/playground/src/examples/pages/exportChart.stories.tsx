import { useContext, useRef, useState } from 'react';
import { GraphicWalker, IGWHandler } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { IDataSource, useFetch } from '../util';

export default function ExportChartExample() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const gwRef = useRef<IGWHandler>(null);
    const [type, setType] = useState<'png' | 'svg'>('png');

    const download = async () => {
        if (!gwRef.current) return;
        if (type === 'svg') {
            const res = await gwRef.current.exportChart('svg');
            const d = res.charts[0]?.data;
            if (d) {
                const blob = new Blob([d], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${res.title || 'chart'}.svg`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } else {
            const res = await gwRef.current.exportChart('data-url');
            const d = res.charts[0]?.data;
            if (d) {
                const a = document.createElement('a');
                a.href = d.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
                a.download = `${res.title || 'chart'}.png`;
                a.click();
            }
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2 m-2 items-center">
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'png' | 'svg')}
                    className="h-9 px-2 py-1 border rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
                >
                    <option value="png">PNG</option>
                    <option value="svg">SVG</option>
                </select>
                <button
                    onClick={download}
                    className="h-9 px-4 py-2 bg-zinc-950 text-white shadow hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                    Download
                </button>
            </div>
            <GraphicWalker ref={gwRef} fields={fields} data={dataSource} appearance={theme} vizThemeConfig="g2" />
        </div>
    );
}
