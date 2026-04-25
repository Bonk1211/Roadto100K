import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        id: '/',
        name: 'SafeSend User App',
        short_name: 'SafeSend',
        description: "SafeSend transfer interception demo for Touch 'n Go style wallet flows.",
        theme_color: '#005BAC',
        background_color: '#F4F8FC',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/safesend-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/safesend-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/safesend-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/user-app-mobile.png',
            sizes: '540x1200',
            type: 'image/png',
            label: 'SafeSend mobile transfer interception flow',
          },
          {
            src: '/screenshots/user-app-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'SafeSend desktop install preview',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
