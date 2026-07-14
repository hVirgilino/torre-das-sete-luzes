import { defineConfig } from 'vite';

// base './' garante compatibilidade total com GitHub Pages (subpasta) e Vercel
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600
  }
});
