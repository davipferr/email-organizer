import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, the NestJS backend runs on :3000; in production Caddy does this routing.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
