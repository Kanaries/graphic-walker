import React, { useRef } from 'react';
import PlotlyRendererConfig, { PlotlyRenderer } from '../lib';
import type { IRendererHandler, IRendererProps } from '../lib/interfaces';

// Sample data
const sampleData = [
    { category: 'A', value: 30, group: 'Group 1', date: '2024-01-01' },
    { category: 'B', value: 45, group: 'Group 1', date: '2024-01-02' },
    { category: 'C', value: 60, group: 'Group 1', date: '2024-01-03' },
    { category: 'D', value: 35, group: 'Group 1', date: '2024-01-04' },
    { category: 'A', value: 25, group: 'Group 2', date: '2024-01-01' },
    { category: 'B', value: 55, group: 'Group 2', date: '2024-01-02' },
    { category: 'C', value: 40, group: 'Group 2', date: '2024-01-03' },
    { category: 'D', value: 50, group: 'Group 2', date: '2024-01-04' },
];

const fields = {
    category: {
        fid: 'category',
        name: 'Category',
        semanticType: 'nominal' as const,
        analyticType: 'dimension' as const,
    },
    value: {
        fid: 'value',
        name: 'Value',
        semanticType: 'quantitative' as const,
        analyticType: 'measure' as const,
        aggName: 'sum',
    },
    group: {
        fid: 'group',
        name: 'Group',
        semanticType: 'nominal' as const,
        analyticType: 'dimension' as const,
    },
    date: {
        fid: 'date',
        name: 'Date',
        semanticType: 'temporal' as const,
        analyticType: 'dimension' as const,
    },
};

function App() {
    const rendererRef = useRef<IRendererHandler>(null);
    const [geomType, setGeomType] = React.useState('bar');
    const [useColor, setUseColor] = React.useState(true);
    const [stack, setStack] = React.useState<'none' | 'stack' | 'normalize'>('none');
    const [chartType, setChartType] = React.useState<'bar' | 'line' | 'scatter'>('bar');

    const handleExportPNG = async () => {
        if (rendererRef.current) {
            await rendererRef.current.downloadPNG('chart.png');
        }
    };

    const handleExportSVG = async () => {
        if (rendererRef.current) {
            await rendererRef.current.downloadSVG('chart.svg');
        }
    };

    const getChartProps = (): Partial<IRendererProps> => {
        switch (chartType) {
            case 'bar':
                return {
                    rows: [fields.value],
                    columns: [fields.category],
                    color: useColor ? fields.group : undefined,
                    geomType: 'bar',
                };
            case 'line':
                return {
                    rows: [fields.value],
                    columns: [fields.date],
                    color: useColor ? fields.group : undefined,
                    geomType: 'line',
                };
            case 'scatter':
                return {
                    rows: [fields.value],
                    columns: [fields.value], // Would need another measure field
                    color: useColor ? fields.group : undefined,
                    size: fields.value,
                    geomType: 'point',
                };
            default:
                return {};
        }
    };

    const chartProps = getChartProps();

    return (
        <div className="app">
            <h1>Plotly Renderer Demo</h1>
            
            <div className="controls">
                <h2>Controls</h2>
                
                <div>
                    <label>
                        Chart Type:
                        <select value={chartType} onChange={(e) => setChartType(e.target.value as any)}>
                            <option value="bar">Bar Chart</option>
                            <option value="line">Line Chart</option>
                            <option value="scatter">Scatter Plot</option>
                        </select>
                    </label>
                </div>

                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={useColor}
                            onChange={(e) => setUseColor(e.target.checked)}
                        />
                        Use Color Encoding
                    </label>
                </div>

                {chartType === 'bar' && (
                    <div>
                        <label>
                            Stack Mode:
                            <select value={stack} onChange={(e) => setStack(e.target.value as any)}>
                                <option value="none">None</option>
                                <option value="stack">Stack</option>
                                <option value="normalize">Normalize</option>
                            </select>
                        </label>
                    </div>
                )}

                <div className="export-buttons">
                    <button onClick={handleExportPNG}>Export PNG</button>
                    <button onClick={handleExportSVG}>Export SVG</button>
                </div>
            </div>

            <div className="chart-container">
                <h2>Chart</h2>
                <PlotlyRenderer
                    ref={rendererRef}
                    dataSource={sampleData}
                    rows={chartProps.rows || []}
                    columns={chartProps.columns || []}
                    color={chartProps.color}
                    size={chartProps.size}
                    geomType={chartProps.geomType || 'bar'}
                    stack={stack}
                    defaultAggregate={true}
                    interactiveScale={true}
                    showActions={true}
                    layoutMode="fixed"
                    width={800}
                    height={500}
                    vegaConfig={{}}
                    onGeomClick={(values, e) => {
                        console.log('Click event:', values, e);
                    }}
                    onReportSpec={(spec) => {
                        console.log('Plotly spec:', spec);
                    }}
                />
            </div>

            <div className="info">
                <h2>About This Demo</h2>
                <p>
                    This demo shows the Plotly.js renderer for Graphic Walker.
                    The renderer transforms Graphic Walker's configuration into Plotly specifications.
                </p>
                <h3>Features:</h3>
                <ul>
                    <li>Multiple chart types (bar, line, scatter)</li>
                    <li>Color encoding for grouping</li>
                    <li>Stacking for bar charts</li>
                    <li>Export to PNG and SVG</li>
                    <li>Interactive tooltips and zoom</li>
                </ul>
                <h3>Renderer Configuration:</h3>
                <pre>{JSON.stringify(PlotlyRendererConfig, null, 2)}</pre>
            </div>
        </div>
    );
}

export default App;