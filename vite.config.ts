import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // En GitHub Pages la app vive bajo /<nombre-del-repo>/; el workflow de
  // despliegue define BASE_PATH. En local queda '/'.
  base: process.env.BASE_PATH ?? '/',
})
