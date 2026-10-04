import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import './site.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteApp } from './SiteApp';

const container = document.getElementById('site-root');
if (!container) throw new Error('#site-root not found');
createRoot(container).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>,
);
