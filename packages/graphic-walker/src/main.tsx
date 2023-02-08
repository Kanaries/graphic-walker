import React from 'react'
import ReactDOM from 'react-dom'
import { GraphicWalker } from './index'

ReactDOM.render(
  <React.StrictMode>
    <GraphicWalker styles={{ shadowRoot: { width: '100%', height: '100%' } }} />
  </React.StrictMode>,
  document.getElementById('root')
)
