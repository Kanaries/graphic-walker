# Component Library Template

A minimal React component library template with TypeScript support and demo app.

## Quick Start

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build library
yarn build
```

## Project Structure

```
src/
├── lib/                    # Library source code
│   ├── components/         # React components
│   │   ├── hello-world.tsx
│   │   └── button.tsx
│   ├── hooks/             # Custom hooks
│   │   └── use-counter.ts
│   └── utils/             # Utility functions
└── demo/                  # Demo application
    ├── app.tsx
    ├── index.html
    └── main.tsx
```

## Available Scripts

- `yarn dev` - Start demo app in development mode
- `yarn build` - Build library for production
- `yarn build:lib` - Build library only
- `yarn build:types` - Generate TypeScript declarations
- `yarn lint` - Run linter

## Example Usage

```tsx
import { HelloWorld, Button, useCounter } from 'your-library';

function App() {
  const { count, increment } = useCounter();
  
  return (
    <>
      <HelloWorld name="React" />
      <Button onClick={increment}>Count: {count}</Button>
    </>
  );
}
```

## Exports

The library exports:
- **Components**: HelloWorld, Button
- **Hooks**: useCounter
- **Utils**: formatName, getGreeting

## License

MIT