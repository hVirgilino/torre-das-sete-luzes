// tipos do cliente do Vite — é o que dá `import.meta.env.DEV` ao TypeScript
// (usado na Tower para esconder o botão de depuração no build de produção)
/// <reference types="vite/client" />

/** injetado pelo Vite a partir do package.json (ver vite.config.ts) */
declare const __VERSAO__: string;
