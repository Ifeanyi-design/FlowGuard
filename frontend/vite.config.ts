import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Local dev: /api is proxied to the backend, so no .env file is needed.
// Override with BACKEND_URL=... when the API runs elsewhere.
// Production (Render Static Site): set VITE_API_URL to the backend URL.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true
        }
      }
    },
    preview: { port: 4173 }
  };
});
