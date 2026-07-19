import { defineConfig } from 'vite';
import { loadEnv } from './server/env.mjs';

// Load .env so vite and server agree on the port (see STAY22_SERVER_PORT in .env.example).
loadEnv();
const STAY22_SERVER_PORT = process.env.STAY22_SERVER_PORT || process.env.PORT || 8787;

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${STAY22_SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
