import { createElement, lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

const root = document.getElementById('root');

if (!root) throw new Error('Application root element is missing.');

// Vite removes the development provider branch and persona module from production assets.
const sessionProvider = import.meta.env.DEV
  ? lazy(() => import('./auth/DevSessionProvider'))
  : lazy(() =>
      import('./auth/ProductionSessionProvider').then((module) => ({
        default: module.ProductionSessionProvider,
      })),
    );

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<p role="status">Loading authentication…</p>}>
        {createElement(sessionProvider, null, <App />)}
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
