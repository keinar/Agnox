import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the monorepo root package.json so __APP_VERSION__ is always in sync
// with the single authoritative version field — no manual updates required.
const rootPkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    // Replaced at build time; consumed by src/config/version.ts
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  server: {
    port: 5173,
  },
});
