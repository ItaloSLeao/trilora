import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  server: { proxy: { '/api': 'http://127.0.0.1:8001' } },
  plugins: [react()],
  test: {
    include: ['checks/**/*.spec.{ts,tsx}'],
    exclude: ['checks/browser/**'],
  },
})
