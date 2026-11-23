import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.CHARDHO_API_URL || 'http://127.0.0.1:8787';

/**
 * The 3D scene is a dynamic import, so three.js must not be preloaded on every
 * route. Vite still emits a modulepreload hint for the manual chunk; dropping it
 * keeps ~1.1 MB off the initial page load and leaves the fetch to the lazy import.
 */
const deferScenePreload = {
  name: 'chardho-defer-scene-preload',
  transformIndexHtml(html) {
    return html.replace(/<link rel="modulepreload"[^>]*href="[^"]*\/assets\/three-[^"]*"[^>]*>\s*/g, '');
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), deferScenePreload],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 5173),
    strictPort: false,
    // The Arena preview proxy and similar hosts must be accepted.
    allowedHosts: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: {
    target: 'es2022',
    // three.js is intentionally one large, lazily loaded chunk.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion', 'gsap'],
        },
      },
    },
  },
});
