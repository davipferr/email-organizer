import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Ports come from scripts/dev.mjs when several instances run in parallel (slots);
// the defaults are slot 0.
const port = Number(process.env.VITE_PORT ?? 5173)
const apiPort = Number(process.env.API_PORT ?? 3000)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    // In dev, the NestJS backend runs on its own port; in production Caddy does this routing.
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
})
