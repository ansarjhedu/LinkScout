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
  server: {
    port: 3000,
    open: true
  }
});