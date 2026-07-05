import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'LiLief-Workout',
        short_name: 'LiLief',
        description: 'Selbst-gehostete Workout-PWA',
        display: 'standalone',
        background_color: '#f6f2fb',
        theme_color: '#f6f2fb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
