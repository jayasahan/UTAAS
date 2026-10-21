import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

const root = document.getElementById('root');

if (!root) throw new Error('Application root element is missing.');

// Vite removes this import branch and the entire development login module in production.
const DevSessionProvider = import.meta.env.DEV
  ? lazy(() => import('./auth/DevSessionProvider'))
  : undefined;

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      {DevSessionProvider ? (
        <Suspense
          fallback={<p role="status">Loading development session controls…</p>}
        >
          <DevSessionProvider>
            <App />
          </DevSessionProvider>
        </Suspense>
      ) : (
        <App />
      )}
    </BrowserRouter>
  </StrictMode>,
);
