import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
