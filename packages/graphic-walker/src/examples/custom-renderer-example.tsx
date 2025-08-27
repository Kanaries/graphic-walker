/**
 * Example: How to use a custom renderer with Graphic Walker
 * 
 * This example demonstrates how to:
 * 1. Import and register a custom renderer
 * 2. Use the custom renderer in Graphic Walker
 * 3. Switch between different renderers dynamically
 */

import React, { useState } from 'react';
import GraphicWalker from '@kanaries/graphic-walker';
import { registerRenderer, getRenderer, getAllRenderers } from '@kanaries/graphic-walker';
// Import your custom renderer package
// import PlotlyRendererConfig from 'graphic-walker-plotly-renderer';

// Mock data for demonstration
const mockData = [
    { date: '2024-01-01', sales: 100, category: 'A' },
    { date: '2024-01-02', sales: 120, category: 'B' },
    { date: '2024-01-03', sales: 90, category: 'A' },
    { date: '2024-01-04', sales: 150, category: 'B' },
    { date: '2024-01-05', sales: 130, category: 'A' },
];

const fields = [
    { fid: 'date', name: 'Date', semanticType: 'temporal', analyticType: 'dimension' },
    { fid: 'sales', name: 'Sales', semanticType: 'quantitative', analyticType: 'measure' },
    { fid: 'category', name: 'Category', semanticType: 'nominal', analyticType: 'dimension' },
];

function CustomRendererExample() {
    const [selectedRenderer, setSelectedRenderer] = useState('vega-lite');
    
    // Register custom renderer on component mount
    React.useEffect(() => {
        // Example: Register Plotly renderer
        // registerRenderer(PlotlyRendererConfig);
        
        // You can also create a simple custom renderer inline
        const simpleCustomRenderer = {
            id: 'simple-custom',
            displayName: 'Simple Custom Renderer',
            component: React.forwardRef((props, ref) => {
                // Your custom renderer implementation
                return (
                    <div>
                        <h3>Custom Renderer</h3>
                        <pre>{JSON.stringify(props.dataSource, null, 2)}</pre>
                    </div>
                );
            }),
            spec: {
                toSpec: (props) => {
                    // Transform props to your custom spec format
                    return {
                        data: props.dataSource,
                        fields: {
                            rows: props.rows,
                            columns: props.columns,
                        },
                    };
                },
            },
            supportedGeomTypes: ['bar', 'line', 'point'],
            supportedFeatures: ['basic-charts'],
        };
        
        // Register the custom renderer
        registerRenderer(simpleCustomRenderer);
    }, []);
    
    // Get all available renderers
    const availableRenderers = getAllRenderers();
    
    return (
        <div>
            <h1>Custom Renderer Example</h1>
            
            {/* Renderer Selector */}
            <div style={{ marginBottom: '20px' }}>
                <label>
                    Select Renderer:
                    <select 
                        value={selectedRenderer} 
                        onChange={(e) => setSelectedRenderer(e.target.value)}
                        style={{ marginLeft: '10px' }}
                    >
                        {availableRenderers.map(renderer => (
                            <option key={renderer.id} value={renderer.id}>
                                {renderer.displayName}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            
            {/* Graphic Walker with Custom Renderer */}
            <GraphicWalker
                data={mockData}
                fields={fields}
                layout={{
                    renderer: selectedRenderer,
                    size: {
                        mode: 'fixed',
                        width: 800,
                        height: 600,
                    },
                }}
            />
            
            {/* Information Panel */}
            <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
                <h3>Renderer Information</h3>
                {(() => {
                    const renderer = getRenderer(selectedRenderer);
                    if (renderer) {
                        return (
                            <div>
                                <p><strong>ID:</strong> {renderer.id}</p>
                                <p><strong>Name:</strong> {renderer.displayName}</p>
                                <p><strong>Supported Geometries:</strong> {renderer.supportedGeomTypes?.join(', ') || 'All'}</p>
                                <p><strong>Features:</strong> {renderer.supportedFeatures?.join(', ') || 'All'}</p>
                            </div>
                        );
                    }
                    return <p>Renderer not found</p>;
                })()}
            </div>
        </div>
    );
}

export default CustomRendererExample;