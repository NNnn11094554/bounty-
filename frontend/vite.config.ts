import { readFileSync } from 'node:fs';
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY ?? 'http://localhost:3000';
  const publicUrl = env.VITE_WEBAPP_URL || env.RENDER_EXTERNAL_URL || undefined;
  return {
    plugins: [react(), tonConnectManifest(publicUrl)],
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
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            motion: ['framer-motion'],
          },
        },
      },
    },
  };
});
