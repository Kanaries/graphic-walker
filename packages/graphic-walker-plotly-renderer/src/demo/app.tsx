import React, { useState, useEffect } from 'react';
import { GraphicWalker, registerRenderer, getAllRenderers } from '@kanaries/graphic-walker';
// CSS is bundled in the main JS file
import PlotlyRendererConfig from '../lib';
import './index.css';

// Sample dataset - Sales data
const sampleData = [
    { date: '2024-01-01', sales: 4500, profit: 1200, category: 'Electronics', region: 'North', quantity: 45 },
    { date: '2024-01-02', sales: 3200, profit: 800, category: 'Clothing', region: 'South', quantity: 62 },
    { date: '2024-01-03', sales: 5100, profit: 1500, category: 'Electronics', region: 'East', quantity: 38 },
    { date: '2024-01-04', sales: 2800, profit: 600, category: 'Food', region: 'West', quantity: 95 },
    { date: '2024-01-05', sales: 6200, profit: 1800, category: 'Electronics', region: 'North', quantity: 52 },
    { date: '2024-01-06', sales: 4100, profit: 1100, category: 'Clothing', region: 'South', quantity: 71 },
    { date: '2024-01-07', sales: 3500, profit: 900, category: 'Food', region: 'East', quantity: 88 },
    { date: '2024-01-08', sales: 5800, profit: 1600, category: 'Electronics', region: 'West', quantity: 41 },
    { date: '2024-01-09', sales: 4300, profit: 1200, category: 'Clothing', region: 'North', quantity: 67 },
    { date: '2024-01-10', sales: 3900, profit: 1000, category: 'Food', region: 'South', quantity: 92 },
    { date: '2024-01-11', sales: 5500, profit: 1400, category: 'Electronics', region: 'East', quantity: 48 },
    { date: '2024-01-12', sales: 3100, profit: 700, category: 'Clothing', region: 'West', quantity: 59 },
    { date: '2024-01-13', sales: 4700, profit: 1300, category: 'Food', region: 'North', quantity: 83 },
    { date: '2024-01-14', sales: 5900, profit: 1700, category: 'Electronics', region: 'South', quantity: 44 },
    { date: '2024-01-15', sales: 3600, profit: 850, category: 'Clothing', region: 'East', quantity: 73 },
];

// Field definitions
const fields = [
    { 
        fid: 'date', 
        name: 'Date', 
        semanticType: 'temporal' as const, 
        analyticType: 'dimension' as const 
    },
    { 
        fid: 'sales', 
        name: 'Sales Amount', 
        semanticType: 'quantitative' as const, 
        analyticType: 'measure' as const 
    },
    { 
        fid: 'profit', 
        name: 'Profit', 
        semanticType: 'quantitative' as const, 
        analyticType: 'measure' as const 
    },
    { 
        fid: 'category', 
        name: 'Product Category', 
        semanticType: 'nominal' as const, 
        analyticType: 'dimension' as const 
    },
    { 
        fid: 'region', 
        name: 'Region', 
        semanticType: 'nominal' as const, 
        analyticType: 'dimension' as const 
    },
    { 
        fid: 'quantity', 
        name: 'Quantity Sold', 
        semanticType: 'quantitative' as const, 
        analyticType: 'measure' as const 
    },
];

function App() {
    const [selectedRenderer, setSelectedRenderer] = useState('vega-lite');
    const [renderers, setRenderers] = useState<any[]>([]);
    const [showInfo, setShowInfo] = useState(true);

    useEffect(() => {
        // Register the Plotly renderer
        registerRenderer(PlotlyRendererConfig);
        
        // Get all available renderers
        const allRenderers = getAllRenderers();
        setRenderers(allRenderers);
        
        // Set Plotly as default if available
        const plotlyRenderer = allRenderers.find(r => r.id === 'plotly');
        if (plotlyRenderer) {
            setSelectedRenderer('plotly');
        }
    }, []);

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Graphic Walker with Plotly Renderer</h1>
                <p>Drag and drop fields to create visualizations using different rendering engines</p>
            </header>

            <div className="controls-section">
                <div className="renderer-selector">
                    <label htmlFor="renderer-select">
                        <strong>Rendering Engine:</strong>
                    </label>
                    <select 
                        id="renderer-select"
                        value={selectedRenderer} 
                        onChange={(e) => setSelectedRenderer(e.target.value)}
                        className="renderer-dropdown"
                    >
                        {renderers.map(renderer => (
                            <option key={renderer.id} value={renderer.id}>
                                {renderer.displayName}
                            </option>
                        ))}
                    </select>
                    <span className="renderer-badge">
                        {selectedRenderer === 'plotly' ? 'Custom Renderer' : 'Built-in'}
                    </span>
                </div>

                <button 
                    className="info-toggle"
                    onClick={() => setShowInfo(!showInfo)}
                >
                    {showInfo ? 'Hide' : 'Show'} Info
                </button>
            </div>

            {showInfo && (
                <div className="info-panel">
                    <h3>Quick Start Guide</h3>
                    <ol>
                        <li>Drag fields from the left panel to the encoding shelves (X-axis, Y-axis, Color, etc.)</li>
                        <li>Choose a chart type from the mark type selector</li>
                        <li>Switch between renderers using the dropdown above</li>
                        <li>Click the settings icon for more configuration options</li>
                    </ol>
                    
                    <div className="renderer-info">
                        <h4>Current Renderer: {renderers.find(r => r.id === selectedRenderer)?.displayName}</h4>
                        {selectedRenderer === 'plotly' && (
                            <div className="feature-list">
                                <h5>Plotly Renderer Features:</h5>
                                <ul>
                                    <li>✓ Interactive zoom and pan</li>
                                    <li>✓ Built-in export to PNG/SVG</li>
                                    <li>✓ Advanced tooltips</li>
                                    <li>✓ 3D chart support (coming soon)</li>
                                    <li>✓ Statistical charts</li>
                                </ul>
                            </div>
                        )}
                        {selectedRenderer === 'vega-lite' && (
                            <div className="feature-list">
                                <h5>Vega-Lite Renderer Features:</h5>
                                <ul>
                                    <li>✓ Grammar of graphics</li>
                                    <li>✓ Declarative visualization</li>
                                    <li>✓ Cross-filtering support</li>
                                    <li>✓ Faceted views</li>
                                    <li>✓ Advanced data transformations</li>
                                </ul>
                            </div>
                        )}
                        {selectedRenderer === 'observable-plot' && (
                            <div className="feature-list">
                                <h5>Observable Plot Features:</h5>
                                <ul>
                                    <li>✓ Modern JavaScript API</li>
                                    <li>✓ Lightweight and fast</li>
                                    <li>✓ D3-based rendering</li>
                                    <li>✓ Responsive by default</li>
                                    <li>✓ Clean, minimal design</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="graphic-walker-container">
                <GraphicWalker
                    data={sampleData}
                    fields={fields}
                    spec=""
                    i18nLang="en-US"
                    keepAlive={false}
                    dark="light"
                    appearance="light"
                    toolbar={{
                        enabled: true,
                        items: ['export', 'new', 'undo', 'redo']
                    }}
                    defaultConfig={{
                        layout: {
                            renderer: selectedRenderer,
                            size: {
                                mode: 'auto',
                                width: 800,
                                height: 600
                            },
                            showActions: true,
                            interactiveScale: true,
                            stack: 'stack',
                            showTableSummary: true,
                            format: {
                                numberFormat: ',.0f',
                                timeFormat: '%Y-%m-%d',
                                normalizedNumberFormat: '0.0%'
                            }
                        }
                    }}
                />
            </div>

            <footer className="app-footer">
                <div className="footer-content">
                    <div>
                        <h4>About This Demo</h4>
                        <p>
                            This demo showcases the extensible renderer architecture of Graphic Walker.
                            The Plotly renderer is a custom plugin that transforms Graphic Walker's
                            specifications into Plotly.js visualizations.
                        </p>
                    </div>
                    <div>
                        <h4>Sample Dataset</h4>
                        <p>
                            Using sales data with {sampleData.length} records across {fields.length} fields.
                            Try different combinations of dimensions and measures to explore the data.
                        </p>
                    </div>
                    <div>
                        <h4>Resources</h4>
                        <ul>
                            <li><a href="https://github.com/Kanaries/graphic-walker">Graphic Walker GitHub</a></li>
                            <li><a href="https://plotly.com/javascript/">Plotly.js Documentation</a></li>
                            <li><a href="https://vega.github.io/vega-lite/">Vega-Lite Spec</a></li>
                        </ul>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;