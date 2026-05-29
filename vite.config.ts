import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'local'
const commitRef = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? 'local'
const buildTime = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('framer-motion')) {
            return 'motion'
          }
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_COMMIT_SHA__: JSON.stringify(commitSha),
    __APP_COMMIT_REF__: JSON.stringify(commitRef),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
})
