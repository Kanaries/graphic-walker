# Graphic Walker Plotly Renderer

A Plotly.js renderer for [Graphic Walker](https://github.com/Kanaries/graphic-walker), enabling interactive data visualizations with Plotly's powerful charting capabilities.

## Features

- **Seamless Integration**: Works as a drop-in renderer for Graphic Walker
- **Rich Chart Types**: Supports bar, line, scatter, area, pie, and more chart types
- **Interactive Visualizations**: Leverages Plotly's built-in interactivity
- **Export Capabilities**: Export charts as PNG or SVG
- **Vega-Lite Compatibility**: Transforms Vega-Lite specifications to Plotly

## Installation

```bash
npm install graphic-walker-plotly-renderer
```

## Usage

### Basic Setup

```typescript
import { registerRenderer } from 'graphic-walker/renderer';
import PlotlyRendererConfig from 'graphic-walker-plotly-renderer';

// Register the Plotly renderer
registerRenderer(PlotlyRendererConfig);

// Now you can use 'plotly' as a renderer in Graphic Walker
```

### Using with Graphic Walker

```tsx
import GraphicWalker from 'graphic-walker';
import PlotlyRendererConfig from 'graphic-walker-plotly-renderer';
import { registerRenderer } from 'graphic-walker/renderer';

// Register the renderer once
registerRenderer(PlotlyRendererConfig);

function App() {
  return (
    <GraphicWalker
      data={yourData}
      fields={yourFields}
      // Use the Plotly renderer
      layout={{ renderer: 'plotly' }}
    />
  );
}
```

### Standalone Usage

You can also use the Plotly renderer directly:

```tsx
import { PlotlyRenderer } from 'graphic-walker-plotly-renderer';

function Chart() {
  const rendererRef = useRef();
  
  return (
    <PlotlyRenderer
      ref={rendererRef}
      dataSource={data}
      rows={[measureField]}
      columns={[dimensionField]}
      color={colorField}
      geomType="bar"
      width={800}
      height={500}
      onGeomClick={(values, event) => {
        console.log('Clicked:', values);
      }}
    />
  );
}
```

### Custom Registration

If you need more control over the renderer registration:

```typescript
import { rendererRegistry } from 'graphic-walker/renderer';
import PlotlyRendererConfig from 'graphic-walker-plotly-renderer';

// Customize the renderer configuration
const customPlotlyRenderer = {
  ...PlotlyRendererConfig,
  id: 'custom-plotly',
  displayName: 'My Custom Plotly',
};

// Register with custom configuration
rendererRegistry.register(customPlotlyRenderer);
```

## API Reference

### PlotlyRendererConfig

The main renderer configuration object:

```typescript
{
  id: 'plotly',
  displayName: 'Plotly.js',
  component: PlotlyRenderer,
  spec: {
    toSpec: (props) => PlotlySpec,
    fromVegaLite: (vegaSpec) => PlotlySpec
  },
  supportedGeomTypes: string[],
  supportedFeatures: string[]
}
```

### PlotlyRenderer Props

| Prop | Type | Description |
|------|------|-------------|
| `dataSource` | `IRow[]` | The data to visualize |
| `rows` | `IViewField[]` | Fields for the y-axis |
| `columns` | `IViewField[]` | Fields for the x-axis |
| `color` | `IViewField` | Field for color encoding |
| `size` | `IViewField` | Field for size encoding |
| `geomType` | `string` | Chart type (bar, line, point, etc.) |
| `width` | `number` | Chart width in pixels |
| `height` | `number` | Chart height in pixels |
| `onGeomClick` | `function` | Click event handler |
| `stack` | `IStackMode` | Stacking mode (none, stack, normalize) |

### Export Methods

The renderer ref exposes these methods:

```typescript
interface IRendererHandler {
  getSVGData(): Promise<string[]>;
  getCanvasData(): Promise<string[]>;
  downloadSVG(filename?: string): Promise<string[]>;
  downloadPNG(filename?: string): Promise<string[]>;
}
```

## Supported Chart Types

- **Bar Charts**: Vertical and horizontal bars with stacking support
- **Line Charts**: Time series and categorical lines
- **Scatter Plots**: With size and color encoding
- **Area Charts**: With stacking support
- **Pie Charts**: Using the arc geometry
- **Box Plots**: Statistical distributions

## Development

### Building

```bash
npm run build
```

### Running the Demo

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Architecture

The renderer follows a three-step transformation process:

1. **Graphic Walker Configuration** → Vega-Lite Specification
2. **Vega-Lite Specification** → Plotly Specification
3. **Plotly Specification** → Interactive Chart

This architecture allows the renderer to leverage existing Vega-Lite generation logic while providing Plotly's unique features.

## Customization

### Creating Your Own Renderer

You can create custom renderers by implementing the `IRenderer` interface:

```typescript
import { IRenderer } from 'graphic-walker/renderer';

const myCustomRenderer: IRenderer = {
  id: 'my-renderer',
  displayName: 'My Custom Renderer',
  component: MyRendererComponent,
  spec: {
    toSpec: (props) => {
      // Transform props to your renderer's specification
      return mySpec;
    }
  }
};

// Register your renderer
registerRenderer(myCustomRenderer);
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT