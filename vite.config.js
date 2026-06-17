import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite Configuration for MaxOpp Intelligence Crawler
 * Configures the React and Tailwind CSS v4 plugins for native integration
 * within the Vite bundling pipeline, ensuring optimized client-side delivery.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  base: '/',
  build: {
    target: 'esnext'
  },
  server: {
    port: 3000,
    open: true,
    cors: {
      origin: (process.env.VITE_DEV_CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://link-scout-ten.vercel.app")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    cors: {
      origin: (process.env.VITE_DEV_CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://link-scout-ten.vercel.app")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    }
  }
});