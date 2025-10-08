import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      manifest: {
        name: 'Vision',
        short_name: 'Vision',
        description: 'Mission Control Personal Planning App',
        theme_color: '#0ea5a4',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/futureisticVision.jpg',
            sizes: '512x512',
            type: 'image/jpg'
          }
        ]
      },
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*$/,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'images' }
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache' }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Dev server proxy: forward API requests to the local Gemini proxy (run with `npm run dev:proxy`)
  server: {
    proxy: {
      '/api/agent': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/agent/, '/api/agent')
      },
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
        // keep the /api path so proxy endpoint remains /api/gemini/generate
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
});

