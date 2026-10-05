import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * tonconnect-manifest.json рядом с игрой: кошельки показывают по нему название и иконку.
 * Адрес игры известен только при сборке (VITE_WEBAPP_URL или RENDER_EXTERNAL_URL на Render);
 * без него клиент берёт манифест из API (/api/tonconnect-manifest.json).
 */
function tonConnectManifest(publicUrl: string | undefined): Plugin {
  return {
    name: 'meowgul-tonconnect-manifest',
    apply: 'build',
    generateBundle() {
      if (!publicUrl) return;
      const base = publicUrl.replace(/\/$/, '');
      this.emitFile({
        type: 'asset',
        fileName: 'tonconnect-manifest.json',
        source: `${JSON.stringify({ url: base, name: 'Meowgul', iconUrl: `${base}/assets/generated/icon-192.png` }, null, 2)}\n`,
      });
    },
  };
}

/**
 * Для поисковиков: robots.txt (игра /admin не индексируется) и sitemap.xml со страницей сайта /site/;
 * на странице сайта — полный адрес (canonical, og:url) и полный адрес картинки превью (мессенджеры и соцсети
 * относительный не берут). Адрес — как у манифеста: VITE_WEBAPP_URL (свой домен) или RENDER_EXTERNAL_URL;
 * без него — только robots.txt без карты сайта.
 */
function seoFiles(publicUrl: string | undefined): Plugin {
  const base = publicUrl?.replace(/\/$/, '');
  return {
    name: 'meowgul-seo',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!base || !ctx.filename.replace(/\\/g, '/').endsWith('/site/index.html')) return html;
        const page = `${base}/site/`;
        return html
          .replace(/(property="og:image" content=")\//, `$1${base}/`)
          .replace(
            '</title>',
            `</title>\n    <link rel="canonical" href="${page}" />\n    <meta property="og:url" content="${page}" />`,
          );
      },
    },
    generateBundle() {
      const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        ...(base ? [`Sitemap: ${base}/sitemap.xml`] : []),
      ];
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.join('\n')}\n` });
      if (!base) return;
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${base}/site/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n` +
          '</urlset>\n',
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY ?? 'http://localhost:3000';
  const publicUrl = env.VITE_WEBAPP_URL || env.RENDER_EXTERNAL_URL || undefined;
  return {
    plugins: [react(), tonConnectManifest(publicUrl), seoFiles(publicUrl)],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __STATIC_TONCONNECT_MANIFEST__: JSON.stringify(Boolean(publicUrl)),
    },
    server: {
      port: 5173,
      host: true,
      // в разработке API доступен с того же origin — без CORS и с моковым initData
      proxy: { '/api': { target: apiTarget, changeOrigin: true }, '/health': apiTarget },
    },
    preview: {
      port: 4173,
      host: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: true }, '/health': apiTarget },
    },
    build: {
      target: 'es2020',
      // файлы с хешем — в /build (кешируются навсегда), /assets — картинки из public
      assetsDir: 'build',
      sourcemap: true,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        // игра (index.html) и сайт игры (site/index.html, адрес /site/) — одна сборка, общие чанки
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          site: fileURLToPath(new URL('./site/index.html', import.meta.url)),
        },
        output: {
          // по пакету, а не по имени модуля: jsx-runtime и react-dom/client (CommonJS-прокси) — тоже к React,
          // иначе Rollup кладёт их в чанк framer-motion, и любая страница с JSX (сайт игры) грузит его целиком
          manualChunks(id) {
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
            if (/node_modules[\\/]three[\\/]/.test(id)) return 'three';
            return undefined;
          },
        },
      },
    },
  };
});
