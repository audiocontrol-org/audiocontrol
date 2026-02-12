import React from 'react';
import ReactDOM from 'react-dom/client';
import { initLogCapture } from '@audiocontrol/editor-tools';
import { App } from '@/App';
import '@/index.css';

// Initialize log capture before React renders
initLogCapture();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
