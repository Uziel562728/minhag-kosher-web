import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// SPA redirect handler for GitHub Pages fallback
(function() {
  const redirect = new URLSearchParams(window.location.search).get('p');
  if (redirect) {
    const cleanRedirect = '/' + redirect.replace(/~and~/g, '&').replace(/^\/+/, '');
    const cleanSearch = new URLSearchParams(window.location.search).get('q');
    const finalSearch = cleanSearch ? '?' + cleanSearch.replace(/~and~/g, '&') : '';
    const finalUrl = `${import.meta.env.BASE_URL}${cleanRedirect.substring(1)}${finalSearch}${window.location.hash}`;
    window.history.replaceState(null, null, finalUrl);
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
