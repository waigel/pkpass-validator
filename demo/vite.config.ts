import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@waigel/pkpass-validator': path.resolve(__dirname, '../src/index.ts'),
      '@peculiar/webcrypto': path.resolve(__dirname, './shims/webcrypto.ts'),
    },
  },
});
