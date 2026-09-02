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

function attachGoalsApi(server: { middlewares: { use: Function } }) {
  server.middlewares.use(async (req: { url?: string; method?: string; headers: Record<string, string | string[] | undefined> }, res: { statusCode: number; setHeader: Function; end: Function }, next: () => void) => {
    if (!req.url?.split('?')[0].startsWith('/api/goals')) {
      next();
      return;
    }
    const { handleGoalsPost, onRequestGet, onRequestOptions } = await import('../../functions/api/goals.js');
    const origin = `http://${req.headers.host ?? 'localhost'}`;
    if (req.method === 'OPTIONS') {
      const response = onRequestOptions();
      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
      res.end();
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const response = onRequestGet();
      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
      res.end(await response.text());
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req as unknown as AsyncIterable<Buffer>) chunks.push(chunk);
    const request = new Request(`${origin}${req.url}`, {
      method: req.method,
      headers: { 'content-type': 'application/json', origin },
      body: Buffer.concat(chunks),
    });
    const response = await handleGoalsPost(request, {});
    res.statusCode = response.status;
    response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    res.end(await response.text());
  });
}

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
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
    {
      name: 'heimdall-goals-api',
      configureServer: attachGoalsApi,
      configurePreviewServer: attachGoalsApi,
    },
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
