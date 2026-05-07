import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Vite config: https://vite.dev/config/
export default defineConfig({
  envDir: '..', // load .env from repo root
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Pre-bundle HEIC WASM/lib for reliable dev cold starts (lazy chunk in production).
    include: ['heic2any'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
  },
})
