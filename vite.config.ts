/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// mr2s-backend's CORS allowlist only covers its deployed frontend origins
// (no localhost), so local dev goes through this proxy instead of calling
// the backend directly. Same "/mr2s-api" prefix convention as
// simulation_react, stripped before forwarding.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/mr2s-api': {
        target: process.env.VITE_PROXY_TARGET ?? 'https://quantum.yunseong.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mr2s-api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
