import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    watch: {
      ignored: [
        '**/.chrome-profile/**',
        '**/shots/**',
        '**/zh-shots/**',
        '**/preview/**',
        '**/dist/**',
        '**/*.png',
        '**/.npm-cache/**',
        '**/.*.tmpdir/**',
        '**/*.tmp',
      ],
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2400,
  },
})
