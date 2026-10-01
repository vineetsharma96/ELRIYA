import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: { manualChunks(id) {
        if (id.includes('/node_modules/three/')) return 'three'
        if (id.includes('/node_modules/@react-three/')) return 'renderer'
      } },
    },
  },
})
