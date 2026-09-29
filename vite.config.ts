import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Lee la versión más fresca de CACHE_NAME directamente desde .env.local
 * para que cualquier cambio del usuario se refleje al instante en el navegador
 * sin necesidad de reiniciar el servidor Vite.
 */
function getCurrentCacheName(): string {
  try {
    const envLocalPath = path.resolve(__dirname, '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      const match = content.match(/^VITE_CACHE_NAME\s*=\s*["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {}
  return process.env.VITE_CACHE_NAME || process.env.CACHE_NAME || 'lalan-shell-v3';
}

function pwaServiceWorkerPlugin(): Plugin {
  return {
    name: 'pwa-service-worker-env',
    // 1. En entorno de desarrollo (npm run dev)
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url === '/sw.js') {
          const swPath = path.resolve(__dirname, 'public/sw.js');
          if (fs.existsSync(swPath)) {
            const currentCache = getCurrentCacheName();
            let content = fs.readFileSync(swPath, 'utf-8');
            content = content.replace(
              /const CACHE_NAME = ['"].*?['"];/,
              `const CACHE_NAME = ${JSON.stringify(currentCache)};`
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
        const currentCache = getCurrentCacheName();
        let content = fs.readFileSync(distSwPath, 'utf-8');
        content = content.replace(
          /const CACHE_NAME = ['"].*?['"];/,
          `const CACHE_NAME = ${JSON.stringify(currentCache)};`
        );

        // Pre-cachear también los bundles generados en dist/assets para soporte offline 100% nativo
        const assetsDir = path.resolve(__dirname, 'dist/assets');
        if (fs.existsSync(assetsDir)) {
          const assetFiles = fs
            .readdirSync(assetsDir)
            .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
            .map((f) => `  '/assets/${f}',`);

          if (assetFiles.length > 0) {
            content = content.replace(
              /const ASSETS_CORE = \[([\s\S]*?)\];/,
              (_match, p1) => {
                const cleanP1 = p1.trim().replace(/,\s*$/, '');
                return `const ASSETS_CORE = [\n  ${cleanP1},\n${assetFiles.join('\n')}\n];`;
              }
            );
          }
        }

        fs.writeFileSync(distSwPath, content, 'utf-8');
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const cacheName = env.VITE_CACHE_NAME || env.CACHE_NAME || 'lalan-shell-v3';

  return {
    plugins: [react(), tailwindcss(), pwaServiceWorkerPlugin()],
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
