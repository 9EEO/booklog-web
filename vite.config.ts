import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
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

type JsonResponse = {
  status: (statusCode: number) => JsonResponse
  json: (body: unknown) => void
}

const adminApiDevProxy = (): Plugin => ({
  name: 'admin-api-dev-proxy',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const requestUrl = new URL(request.url ?? '', 'http://localhost')
      const pathname = requestUrl.pathname

      if (!pathname.startsWith('/api/admin')) {
        next()
        return
      }

      const sendJson = (statusCode: number, body: unknown) => {
        response.statusCode = statusCode
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify(body))
      }
      const vercelResponse: JsonResponse = {
        status(statusCode) {
          response.statusCode = statusCode
          return vercelResponse
        },
        json(body) {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(body))
        },
      }
      const query = Object.fromEntries(requestUrl.searchParams.entries())
      const vercelRequest = {
        method: request.method,
        headers: request.headers,
        query,
      }

      try {
        if (pathname === '/api/admin/summary') {
          // @ts-expect-error Vercel API handlers are plain JS modules.
          const module = await import('./api/admin/summary.js')
          await module.default(vercelRequest, vercelResponse)
          return
        }

        if (pathname === '/api/admin/users') {
          // @ts-expect-error Vercel API handlers are plain JS modules.
          const module = await import('./api/admin/users.js')
          await module.default(vercelRequest, vercelResponse)
          return
        }

        const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
        if (userMatch?.[1]) {
          // @ts-expect-error Vercel API handlers are plain JS modules.
          const module = await import('./api/admin/users/[userId].js')
          await module.default(
            {
              ...vercelRequest,
              query: {
                ...query,
                userId: decodeURIComponent(userMatch[1]),
              },
            },
            vercelResponse,
          )
          return
        }

        sendJson(404, { error: 'Admin API route not found' })
      } catch (error) {
        sendJson(500, {
          error:
            error instanceof Error
              ? error.message
              : '관리자 API를 실행하지 못했습니다.',
        })
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  process.env.VITE_SUPABASE_URL ??= env.VITE_SUPABASE_URL
  process.env.SUPABASE_URL ??= env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.SUPABASE_SERVICE_ROLE_KEY

  return {
    plugins: [react(), tailwindcss(), coverImageProxy(), adminApiDevProxy()],
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
  }
})
