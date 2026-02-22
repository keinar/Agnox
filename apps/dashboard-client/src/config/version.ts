// __APP_VERSION__ is injected at build time by vite.config.ts from the root
// package.json. This eliminates the need to maintain a hardcoded version string.
declare const __APP_VERSION__: string;

export const APP_VERSION = `v${__APP_VERSION__}`;
