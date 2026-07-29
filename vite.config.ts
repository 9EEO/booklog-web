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
