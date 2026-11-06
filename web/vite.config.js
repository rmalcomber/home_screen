import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:7878' } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'jsdom' },
})
