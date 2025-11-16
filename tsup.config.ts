import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    sourcemap: true,
    dts: true,
    clean: true,
    target: 'es2020',
    minify: false,
    outDir: 'dist',
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.cjs',
      };
    },
  },
  {
    entry: { 'index.browser': 'src/index.ts' },
    format: ['iife'],
    sourcemap: false,
    dts: false,
    clean: false,
    globalName: 'PkpassValidator',
    minify: true,
    target: 'es2019',
    outDir: 'dist',
    outExtension() {
      return {
        js: '.js',
      };
    },
  }
]);
