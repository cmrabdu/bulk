import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En dev : le front tourne sur :5173 et proxie /api vers le backend local (:8798),
// donc même origine -> le cookie de session fonctionne sans CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8798',
    },
  },
})
