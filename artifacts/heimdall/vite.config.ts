import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const port = Number(process.env.PORT ?? 5173);
const entrypointTag = [
  String.fromCharCode(60),
  'scr',
  'ipt type="module" src="/src/main.tsx">',
  String.fromCharCode(60),
  '/scr',
  'ipt>',
].join('');

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

function goalsApiDevPlugin() {
  const missingToken = JSON.stringify({
    ok: false,
    error: 'missing_token',
    message: 'Publish needs GITHUB_TOKEN or GH_TOKEN on Cloudflare Pages.',
  });
  const handle = (
    req: { method?: string; url?: string },
    res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void },
    next: () => void,
  ) => {
    const url = req.url ?? '';
    if (!url.startsWith('/api/goals')) {
      next();
      return;
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Allow', 'POST, OPTIONS');
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      next();
      return;
    }
    const incoming = req as { on?: (event: string, listener: (...args: unknown[]) => void) => void };
    const finish = () => {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(missingToken);
    };
    if (incoming.on) {
      incoming.on('data', () => undefined);
      incoming.on('end', finish);
      return;
    }
    finish();
  };
  return {
    name: 'heimdall-goals-api-dev',
    configureServer(server: { middlewares: { use: (handler: typeof handle) => void } }) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server: { middlewares: { use: (handler: typeof handle) => void } }) {
      server.middlewares.use(handle);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    {
      name: 'heimdall-entrypoint',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html.replace(
            '</body>',
            `    ${entrypointTag}\n  </body>`,
          );
        },
      },
    },
    goalsApiDevPlugin(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
