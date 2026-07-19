import { defineConfig } from 'vite';

// server/index.mjs listens on this port (see STAY22_SERVER_PORT in .env.example).
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
