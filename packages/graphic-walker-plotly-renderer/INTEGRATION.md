# Integration Guide for Plotly Renderer

This guide explains how to integrate the Plotly renderer with Graphic Walker in your application.

## Installation

First, install both Graphic Walker and the Plotly renderer:

```bash
npm install @kanaries/graphic-walker graphic-walker-plotly-renderer plotly.js
# or
yarn add @kanaries/graphic-walker graphic-walker-plotly-renderer plotly.js
```

## Basic Setup

### Step 1: Import Dependencies

```typescript
import React from 'react';
import GraphicWalker, { registerRenderer } from '@kanaries/graphic-walker';
import PlotlyRendererConfig from 'graphic-walker-plotly-renderer';
import '@kanaries/graphic-walker/dist/style.css';
```

### Step 2: Register the Renderer

Register the Plotly renderer before using it:

```typescript
// Register once in your app initialization
registerRenderer(PlotlyRendererConfig);
```

### Step 3: Use in Graphic Walker

```typescript
function App() {
    const data = [
        { date: '2024-01-01', sales: 100, product: 'A' },
        { date: '2024-01-02', sales: 120, product: 'B' },
        // ... more data
    ];
    
    const fields = [
        { fid: 'date', name: 'Date', semanticType: 'temporal', analyticType: 'dimension' },
        { fid: 'sales', name: 'Sales', semanticType: 'quantitative', analyticType: 'measure' },
        { fid: 'product', name: 'Product', semanticType: 'nominal', analyticType: 'dimension' },
    ];
    
    return (
        <GraphicWalker
            data={data}
            fields={fields}
            layout={{
                renderer: 'plotly', // Use the Plotly renderer
                size: {
                    mode: 'fixed',
                    width: 800,
                    height: 600,
                },
            }}
        />
    );
}
```

## Advanced Usage

### Dynamic Renderer Switching

```typescript
import { useState } from 'react';
import { getAllRenderers } from '@kanaries/graphic-walker';

function DynamicRendererApp() {
    const [currentRenderer, setCurrentRenderer] = useState('vega-lite');
    const renderers = getAllRenderers();
    
    return (
        <>
            <select 
                value={currentRenderer} 
                onChange={(e) => setCurrentRenderer(e.target.value)}
            >
                {renderers.map(r => (
                    <option key={r.id} value={r.id}>
                        {r.displayName}
                    </option>
                ))}
            </select>
            
            <GraphicWalker
                data={data}
                fields={fields}
                layout={{ renderer: currentRenderer }}
            />
        </>
    );
}
```

### Direct Plotly Renderer Usage

You can also use the Plotly renderer directly without Graphic Walker:

```typescript
import { PlotlyRenderer } from 'graphic-walker-plotly-renderer';

function DirectUsage() {
    const rendererRef = useRef();
    
    const handleExport = async () => {
        const pngData = await rendererRef.current?.downloadPNG('chart.png');
        console.log('Exported:', pngData);
    };
    
    return (
        <>
            <button onClick={handleExport}>Export PNG</button>
            <PlotlyRenderer
                ref={rendererRef}
                dataSource={data}
                rows={[{ fid: 'sales', name: 'Sales', semanticType: 'quantitative', analyticType: 'measure' }]}
                columns={[{ fid: 'date', name: 'Date', semanticType: 'temporal', analyticType: 'dimension' }]}
                geomType="line"
                width={800}
                height={400}
                vegaConfig={{}}
            />
        </>
    );
}
```

## Configuration Options

The Plotly renderer supports various configuration options:

```typescript
const plotlyConfig = {
    // Custom Plotly configuration
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
    // ... other Plotly config options
};

// Pass configuration through vegaConfig prop
<GraphicWalker
    data={data}
    fields={fields}
    layout={{ renderer: 'plotly' }}
    vegaConfig={plotlyConfig}
/>
```

## Supported Features

The Plotly renderer supports:

- **Chart Types**: Bar, Line, Scatter, Area, Pie, Box plots
- **Encodings**: Color, Size, Shape, Opacity
- **Interactions**: Zoom, Pan, Hover, Click events
- **Export**: PNG, SVG formats
- **Stacking**: Normal, Normalized, Center modes

## Troubleshooting

### Issue: Plotly is not defined

Make sure to install `plotly.js`:

```bash
npm install plotly.js
```

### Issue: Renderer not found

Ensure you've registered the renderer before using it:

```typescript
import { registerRenderer } from '@kanaries/graphic-walker';
import PlotlyRendererConfig from 'graphic-walker-plotly-renderer';

registerRenderer(PlotlyRendererConfig);
```

### Issue: Large bundle size

Plotly.js is a large library. Consider using a custom build or lazy loading:

```typescript
// Lazy load the renderer
const PlotlyRendererConfig = React.lazy(() => import('graphic-walker-plotly-renderer'));
```

## Performance Tips

1. **Use Production Build**: Always use production builds for better performance
2. **Limit Data Size**: Plotly performs best with reasonable data sizes (< 10,000 points)
3. **Optimize Rerenders**: Use React.memo to prevent unnecessary rerenders
4. **Custom Plotly Build**: Create a custom Plotly build with only needed chart types

## Example Projects

Check the `/src/demo` folder in the package for complete examples.

## API Reference

See the main README for detailed API documentation.