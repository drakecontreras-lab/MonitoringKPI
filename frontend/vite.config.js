import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite con plugin React y proxy para el backend de Express
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
