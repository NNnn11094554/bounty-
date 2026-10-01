import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY ?? 'http://localhost:3000';
  return {
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
