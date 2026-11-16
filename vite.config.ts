/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://michael2258.github.io/woodpecker-chess-creator/
  base: '/woodpecker-chess-creator/',
  plugins: [react()],
  test: {
    setupFiles: ['./test/setup.ts'],
  },
})
