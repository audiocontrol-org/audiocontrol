import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { initLogCapture } from '@audiocontrol/editor-core';
import '@audiocontrol/editor-core/styles.css';
import '@/index.css';

// Initialize log capture before React renders
initLogCapture();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

document.documentElement.dataset.editor = 'jv1080';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/roland/jv1080/editor">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
