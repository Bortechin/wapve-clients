import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/target/**', '**/dist-electron/**', '**/release/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: 'esbuild',
    cssMinify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      input: {
        titlebar: resolve(import.meta.dirname, 'index.html'),
        shell: resolve(import.meta.dirname, 'shell.html'),
        picker: resolve(import.meta.dirname, 'picker.html'),
      },
    },
  },
});
