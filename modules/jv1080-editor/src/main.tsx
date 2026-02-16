import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import '@audiocontrol/editor-core/tokens.css';
import '@/index.css';

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
