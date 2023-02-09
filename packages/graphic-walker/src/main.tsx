import React from 'react'
import ReactDOM from 'react-dom'
import { GraphicWalker } from './index'

import { inject } from '@vercel/analytics';

inject();

ReactDOM.render(
  <React.StrictMode>
    <GraphicWalker />
  </React.StrictMode>,
  document.getElementById('root')
)
