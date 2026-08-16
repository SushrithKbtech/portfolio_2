import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      /* BOTH PAGES have to be named here. Vite's default build bundles index.html and nothing
         else, so about.html was simply absent from dist/ — which is why the deployed site 404'd
         on /about.html while the dev server, which serves the source tree directly, was fine. */
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
      },
    },
  },
})
