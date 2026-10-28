import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // '/' for local dev; set BASE_PATH (e.g. '/archnova/') when building for
  // GitHub Pages so asset URLs resolve under the project sub-path.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // The Arena preview proxies the dev server under a per-sandbox hostname.
    allowedHosts: true,
  },
})
