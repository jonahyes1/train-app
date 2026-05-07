import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base ('./') means the built app works regardless of the URL
// subpath GitHub Pages serves it from (e.g. /repo-name/). No hard-coded
// repo name means renaming the repo won't break the deploy.
export default defineConfig({
  base: './',
  plugins: [react()],
})
