import React from 'react';
import ReactDOM from 'react-dom';
import { GraphicWalker } from './index';

import { inject } from '@vercel/analytics';
import './index.css';

if (!import.meta.env.DEV) {
    inject();
}

// Example: Detect if Concurrent Mode is available
const isConcurrentModeAvailable = 'createRoot' in ReactDOM;

// Use the new ReactDOM.createRoot API if available, otherwise fall back to the old ReactDOM.render API
if (isConcurrentModeAvailable) {
    if (import.meta.env.DEV) {
        console.warn('React 18+ detected, remove strict mode if you meet drag and drop issue. more info at https://docs.kanaries.net/graphic-walker/faq/graphic-walker-react-18')
    }
    // @ts-ignore
    const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
    root.render(<GraphicWalker themeKey="g2" />);
} else {
    ReactDOM.render(
        <React.StrictMode>
            <GraphicWalker themeKey="g2" queryMode="server" />
        </React.StrictMode>,
        document.getElementById('root') as HTMLElement
    );
}
