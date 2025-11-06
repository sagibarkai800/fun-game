import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Allows GitHub Pages to override base path at build time, e.g. --base=/repo-name/
  base: process.env.BASE_PATH || '/',
})


