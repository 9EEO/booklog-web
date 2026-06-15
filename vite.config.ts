import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'local'
const commitRef = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? 'local'
const buildTime = new Date().toISOString()
const allowedCoverHosts = new Set([
  'search1.kakaocdn.net',
  'search2.kakaocdn.net',
  'search3.kakaocdn.net',
  'search4.kakaocdn.net',
])

const coverImageProxy = (): Plugin => ({
  name: 'cover-image-proxy',
  configureServer(server) {
    server.middlewares.use('/api/cover-image', async (request, response) => {
      try {
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const source = new URL(requestUrl.searchParams.get('url') ?? '')

        if (source.protocol !== 'https:' || !allowedCoverHosts.has(source.hostname)) {
          response.statusCode = 400
          response.end('Unsupported image source')
          return
        }

        const imageResponse = await fetch(source)
        if (!imageResponse.ok) {
          response.statusCode = imageResponse.status
          response.end('Image fetch failed')
          return
        }

        response.setHeader('Content-Type', imageResponse.headers.get('content-type') ?? 'image/jpeg')
        response.setHeader('Cache-Control', 'public, max-age=86400')
        response.end(Buffer.from(await imageResponse.arrayBuffer()))
      } catch {
        response.statusCode = 400
        response.end('Invalid image URL')
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), coverImageProxy()],
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
