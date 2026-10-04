import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const originalFetch = window.fetch;
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
  let resource = input;
  const baseUrl = import.meta.env.VITE_API_URL;
  if (baseUrl) {
    const urlStr = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url;
    if (urlStr.startsWith('/api') || urlStr.startsWith('/health')) {
      resource = baseUrl.replace(/\/$/, '') + urlStr;
    }
  }
  return originalFetch.call(this, resource, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
