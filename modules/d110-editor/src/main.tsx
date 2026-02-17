import React from 'react';
import ReactDOM from 'react-dom/client';
import { initLogCapture } from '@audiocontrol/editor-tools';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import '@audiocontrol/editor-core/tokens.css';
import '@audiocontrol/editor-core/primitives.css';
import '@/index.css';

// Initialize log capture before React renders
initLogCapture();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

document.documentElement.dataset.editor = 'd110';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/roland/d110/editor">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
