import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TRAVEL } from './shared/travel';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'icons/*.png'],
      manifest: {
        id: '/graikija',
        name: TRAVEL.title,
        short_name: TRAVEL.name,
        description: 'Jūsų kelionės pagalbininkas Graikijoje · Rodo sala',
        lang: 'lt',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#faf8f3',
        theme_color: '#245b85',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: TRAVEL.id,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/join(?:\/|$)/, /^\/stats(?:\/|$)/],
        cleanupOutdatedCaches: true,
        // Personal photos, audio and API replies never enter the service-worker cache.
        runtimeCaching: [],
      },
    }),
  ],
  server: { host: '0.0.0.0' },
  build: { target: 'es2022' },
});
