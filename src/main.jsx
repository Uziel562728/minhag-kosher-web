import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary, { ApplicationErrorFallback } from './components/AppErrorBoundary.jsx'
import { supabaseConfigurationError } from './supabaseClient.js'

// SPA redirect handler for GitHub Pages fallback
(function() {
  const redirectParams = new URLSearchParams(window.location.search);
  const redirect = redirectParams.get('p');
  if (redirect) {
    const cleanRedirect = redirect.replace(/~and~/g, '&').replace(/^\/+/, '');
    const redirectedSearch = redirectParams.get('q');
    const finalSearch = redirectedSearch ? `?${redirectedSearch.replace(/~and~/g, '&')}` : '';
    const finalUrl = `${import.meta.env.BASE_URL}${cleanRedirect}${finalSearch}${window.location.hash}`;
    window.history.replaceState(null, '', finalUrl);
  }
})();

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    {supabaseConfigurationError ? (
      <ApplicationErrorFallback message="No se pudo cargar el catálogo. Intentá nuevamente más tarde." />
    ) : (
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    )}
  </StrictMode>,
);
