import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  root: 'web',
  plugins: [react(), nodePolyfills({ globals: { Buffer: true, process: true } })],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: { outDir: '../dist', emptyOutDir: true },
});
