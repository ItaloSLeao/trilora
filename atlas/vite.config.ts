import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['checks/**/*.spec.{ts,tsx}'], exclude: ['checks/browser/**'] },
})
