import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import './site.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadInitialLocale } from './i18n';
import { SiteApp } from './SiteApp';

const container = document.getElementById('site-root');
if (!container) throw new Error('#site-root not found');
// словарь выбранного языка — до первой отрисовки (пока грузится, виден экран загрузки из index.html)
void loadInitialLocale().then(() =>
  createRoot(container).render(
    <StrictMode>
      <SiteApp />
    </StrictMode>,
  ),
);
