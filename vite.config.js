import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: 'localhost', port: 5173 },
  build: { chunkSizeWarningLimit: 800 }, // three.js is lazy-loaded

  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
