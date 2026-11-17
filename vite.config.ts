import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import electron from 'vite-plugin-electron/simple';

const EXTERNAL = ['electron', 'sql.js', 'path', 'fs', 'os', 'crypto', 'child_process'];

/**
 * The CSP meta of index.html has to stay permissive while the dev server
 * runs, because React's refresh preamble is an inline script and the HMR
 * client talks over a websocket. The packaged page carries no inline script
 * and talks to nothing, so the build rewrites the policy into a strict one
 * that keeps the renderer on its own files.
 */
const strictCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' file: blob: data:",
  "connect-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
const buildStrictCsp: Plugin = {
  name: 'cybergo-strict-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      /<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/>/,
      `<meta http-equiv="Content-Security-Policy" content="${strictCsp}" />`,
    );
  },
};

export default defineConfig({
  base: './',
  plugins: [
    buildStrictCsp,
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: { external: EXTERNAL },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                inlineDynamicImports: true,
                entryFileNames: 'preload.js',
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5288,
    strictPort: false,
  },
});
