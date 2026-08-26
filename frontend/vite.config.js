import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest statt generateSW: der Push-Handler braucht einen eigenen
      // SW (src/sw.js). Navigation-Fallback und NetworkOnly für /api leben dort.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        // .glb mit precachen, sonst fehlt das Muskel-Modell offline
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb}'],
      },
      manifest: {
        name: 'LiLief-Workout',
        short_name: 'LiLief',
        description: 'Selbst-gehostete Workout-PWA',
        display: 'standalone',
        background_color: '#f6f2fb',
        theme_color: '#f6f2fb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': process.env.VITE_API_TARGET ?? 'http://localhost:3000',
    },
  },
})
