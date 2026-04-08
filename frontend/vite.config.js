import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite config: https://vite.dev/config/
export default defineConfig({
  envDir: '..', // load .env from repo root
  plugins: [react(), tailwindcss()],
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
