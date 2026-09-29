import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Plugin para sincronizar la versión de caché del Service Worker (sw.js)
 * directamente con la variable de entorno VITE_CACHE_NAME (o CACHE_NAME)
 * definida en .env.local o variables del sistema.
 */
function pwaServiceWorkerPlugin(cacheName: string): Plugin {
  return {
    name: 'pwa-service-worker-env',
    // 1. En entorno de desarrollo (npm run dev)
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url === '/sw.js') {
          const swPath = path.resolve(__dirname, 'public/sw.js');
          if (fs.existsSync(swPath)) {
            let content = fs.readFileSync(swPath, 'utf-8');
            content = content.replace(
              /const CACHE_NAME = ['"].*?['"];/,
              `const CACHE_NAME = ${JSON.stringify(cacheName)};`
            );
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.end(content);
            return;
          }
        }
        next();
      });
    },
    // 2. En compilación de producción (npm run build)
    closeBundle() {
      const distSwPath = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(distSwPath)) {
        let content = fs.readFileSync(distSwPath, 'utf-8');
        content = content.replace(
          /const CACHE_NAME = ['"].*?['"];/,
          `const CACHE_NAME = ${JSON.stringify(cacheName)};`
        );
        fs.writeFileSync(distSwPath, content, 'utf-8');
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const cacheName = env.VITE_CACHE_NAME || env.CACHE_NAME || 'lalan-shell-v3';

  return {
    plugins: [react(), tailwindcss(), pwaServiceWorkerPlugin(cacheName)],
    define: {
      'import.meta.env.VITE_CACHE_NAME': JSON.stringify(cacheName),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    /*
     * Dos páginas en el mismo proyecto:
     *   /      → la landing pública (sin sesión, sin React)
     *   /app/  → la aplicación del salón (y sus pantallas públicas #/pantalla…)
     */
    build: {
      rollupOptions: {
        input: {
          landing: path.resolve(__dirname, 'index.html'),
          app: path.resolve(__dirname, 'app/index.html'),
        },
      },
    },
    server: {
      port: 5173,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
