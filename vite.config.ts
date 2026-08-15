import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],

      manifest: {
        name: 'Nautium',
        short_name: 'Nautium',
        description: 'Every vessel under control',
        theme_color: '#051826',
        background_color: '#051826',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        // Solo cachea JS, CSS, HTML y fuentes — NO imágenes
        globPatterns: ['**/*.{js,css,html,woff2}'],

        navigateFallbackDenylist: [/^\/functions/, /^\/auth/],

        runtimeCaching: [
          // ── Supabase Storage (fotos, archivos) → NUNCA cachear ──
          // Siempre carga desde la red — cambios visibles inmediatamente
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage/,
            handler: 'NetworkOnly',
          },

          // ── Supabase Auth → NUNCA cachear ──
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth/,
            handler: 'NetworkOnly',
          },

          // ── Supabase Edge Functions → NUNCA cachear ──
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions/,
            handler: 'NetworkOnly',
          },

          // ── Supabase REST API (datos) → Network first ──
          // Sin internet: muestra últimos datos cacheados
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 horas
              },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
