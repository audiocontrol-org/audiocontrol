import React from 'react';
import ReactDOM from 'react-dom/client';
import { initLogCapture } from '@audiocontrol/editor-core';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import '@audiocontrol/editor-core/styles.css';
import '@/index.css';

initLogCapture();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

document.documentElement.dataset.editor = 'standalone-sampler';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/sampler">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
