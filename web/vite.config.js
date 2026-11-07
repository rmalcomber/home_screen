import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:7878' } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Each extension (src/extensions/<id>/index.js) is loaded on demand as its own chunk: name it after the extension.
      output: {
        chunkFileNames: (chunk) => {
          const m = /extensions\/([^/]+)\/index\.js$/.exec((chunk.facadeModuleId || '').split(String.fromCharCode(92)).join('/'))
          return m ? `assets/ext-${m[1]}-[hash].js` : 'assets/[name]-[hash].js'
        },
      },
    },
  },
  test: { environment: 'jsdom' },
})
