import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY ?? 'http://localhost:3000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      // в разработке API доступен с того же origin — без CORS и с моковым initData
      proxy: { '/api': { target: apiTarget, changeOrigin: true }, '/health': apiTarget },
    },
    preview: { port: 4173, host: true },
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
