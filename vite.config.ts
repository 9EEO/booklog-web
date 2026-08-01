import type { IncomingMessage, ServerResponse } from 'node:http'
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

type DevJsonRequest = IncomingMessage & {
  body?: unknown
  query?: Record<string, string>
}

type VercelJsonResponse = ServerResponse & {
  status: (statusCode: number) => VercelJsonResponse
  json: (body: unknown) => void
}

type VercelJsonHandler = (
  request: DevJsonRequest,
  response: VercelJsonResponse,
) => Promise<void>

const loadLocalEnv = () => {
  try {
    const envFile = readFileSync(new URL('./.env.local', import.meta.url), 'utf-8')

    envFile.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) return

      const key = trimmed.slice(0, separatorIndex)
      const value = trimmed.slice(separatorIndex + 1)
      process.env[key] ??= value
    })
  } catch {
    // .env.local is optional for UI-only development.
  }
}

const readJsonBody = async (request: IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf-8').trim()
      if (!text) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })

const withVercelJsonResponse = (response: ServerResponse): VercelJsonResponse => {
  const jsonResponse = response as VercelJsonResponse

  jsonResponse.status = (statusCode: number) => {
    response.statusCode = statusCode
    return jsonResponse
  }
  jsonResponse.json = (body: unknown) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(body))
  }

  return jsonResponse
}

const getQuery = (url: URL) =>
  Object.fromEntries(url.searchParams.entries())

const loadAdminHandler = async (
  pathname: string,
  query: Record<string, string>,
): Promise<VercelJsonHandler | null> => {
  if (pathname === '/summary') {
    const { default: handler } = await import('./api/admin/summary.js') as { default: VercelJsonHandler }
    return handler
  }

  if (pathname === '/library-references') {
    const { default: handler } = await import('./api/admin/library-references.js') as { default: VercelJsonHandler }
    return handler
  }

  if (pathname === '/users') {
    const { default: handler } = await import('./api/admin/users.js') as { default: VercelJsonHandler }
    return handler
  }

  if (pathname.startsWith('/users/')) {
    query.userId = decodeURIComponent(pathname.slice('/users/'.length))
    const { default: handler } = await import('./api/admin/users/[userId].js') as { default: VercelJsonHandler }
    return handler
  }

  return null
}

const devApiMiddleware = (): Plugin => ({
  name: 'dev-api-middleware',
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

    server.middlewares.use('/api/book-chat', async (request, response) => {
      try {
        loadLocalEnv()
        const jsonRequest = request as DevJsonRequest
        jsonRequest.body = await readJsonBody(request)
        const { default: bookChatHandler } = await import('./api/book-chat.js') as {
          default: VercelJsonHandler
        }

        await bookChatHandler(jsonRequest, withVercelJsonResponse(response))
      } catch {
        response.statusCode = 400
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: 'AI 요청 형식이 올바르지 않습니다.' }))
      }
    })

    server.middlewares.use('/api/book-library-reference', async (request, response) => {
      try {
        loadLocalEnv()
        const jsonRequest = request as DevJsonRequest
        jsonRequest.body = await readJsonBody(request)
        const { default: bookLibraryReferenceHandler } = await import('./api/book-library-reference.js') as {
          default: VercelJsonHandler
        }

        await bookLibraryReferenceHandler(jsonRequest, withVercelJsonResponse(response))
      } catch {
        response.statusCode = 400
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: '정보나루 요청 형식이 올바르지 않습니다.' }))
      }
    })

    server.middlewares.use('/api/word-lookup', async (request, response) => {
      try {
        loadLocalEnv()
        const jsonRequest = request as DevJsonRequest
        jsonRequest.body = await readJsonBody(request)
        const { default: wordLookupHandler } = await import('./api/word-lookup.js') as {
          default: VercelJsonHandler
        }

        await wordLookupHandler(jsonRequest, withVercelJsonResponse(response))
      } catch {
        response.statusCode = 400
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: '단어 검색 요청 형식이 올바르지 않습니다.' }))
      }
    })

    server.middlewares.use('/api/admin', async (request, response) => {
      try {
        loadLocalEnv()
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const pathname = requestUrl.pathname.replace(/^\/api\/admin/, '') || '/'
        const query = getQuery(requestUrl)
        const handler = await loadAdminHandler(pathname, query)

        if (!handler) {
          response.statusCode = 404
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ error: '관리자 API를 찾지 못했습니다.' }))
          return
        }

        const jsonRequest = request as DevJsonRequest
        jsonRequest.query = query

        await handler(jsonRequest, withVercelJsonResponse(response))
      } catch {
        response.statusCode = 400
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: '관리자 요청 형식이 올바르지 않습니다.' }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApiMiddleware()],
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
