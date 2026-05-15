import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('maplibre-gl'))       return 'maplibre';
          if (id.includes('@turf'))             return 'turf';
          if (id.includes('@react-pdf'))        return 'pdf';
          if (id.includes('recharts'))          return 'recharts';
          if (id.includes('@radix-ui'))         return 'radix';
        },
      },
    },
  },
})
