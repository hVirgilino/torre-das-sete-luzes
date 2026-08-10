import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// lido do package.json para a versão mostrada no menu nunca divergir da real
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// base './' garante compatibilidade total com GitHub Pages (subpasta) e Vercel
export default defineConfig({
  base: './',
  define: {
    __VERSAO__: JSON.stringify(version)
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600
  }
});
