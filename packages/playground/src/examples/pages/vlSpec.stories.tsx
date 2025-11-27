import { useContext, useState } from 'react';
import { themeContext } from '../context';
import { GraphicWalker } from '@kanaries/graphic-walker';
import { IDataSource, useFetch } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const [vlSpec, setVlspec] = useState<unknown>(undefined);
    const [input, setInput] = useState<string>(`{
    "mark": "bar",
    "encoding": {
        "x": {
            "field": "parental level of education",
            "type": "nominal",
            "title": "parental level of education"
        },
        "y": {
            "field": "math score",
            "type": "quantitative",
            "title": "mean(math score)",
            "aggregate": "mean"
        },
        "color": {
            "field": "gender",
            "type": "nominal",
            "title": "gender"
        }
    }
}`);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };

    const handleApply = () => {
        try {
            const spec = JSON.parse(input);
            setVlspec(spec);
        } catch (error) {
            alert('Invalid JSON');
        }
    };
    return (
        <div>
            <div className="mb-4 flex flex-col gap-2">
                <textarea value={input} onChange={handleChange} placeholder="Enter VL Spec JSON here" className="h-36 m-2 border rounded" />
                <button
                    className="ml-2 w-min h-9 px-4 py-2 bg-zinc-950 text-white shadow hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    onClick={handleApply}
                >
                    Apply VL Spec
                </button>
            </div>
            <div>Try to open `Export Code` and copy the Vega-Lite spec and re-paste it here, then click Apply.</div>
            <div style={{ border: '1px solid #ccc', padding: '8px' }}>
                <GraphicWalker fields={fields} data={dataSource} appearance={theme} vizThemeConfig="g2" vlSpec={vlSpec} />;
            </div>
        </div>
    );
}
