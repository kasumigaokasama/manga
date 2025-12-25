import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'node:path'
import fs from 'node:fs'
import { authRequired } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import booksRoutes from './routes/books.js'
import tagsRoutes from './routes/tags.js'
import usersRoutes from './routes/users.js'
import auditRoutes from './routes/audit.js'
import accountRoutes from './routes/account.js'
import { RateLimiterMemory } from 'rate-limiter-flexible'

export function createApp() {
  const app = express()
  // Behind proxies/load balancers, trust the first hop for IP rate limiting and headers
  app.set('trust proxy', 1)
  // Configure helmet - disable CSP when serving frontend (let reverse proxy handle it)
  app.use(helmet({
    contentSecurityPolicy: process.env.SERVE_FRONTEND === '1' ? false : undefined,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }))
  app.use(express.json({ limit: `${process.env.MAX_UPLOAD_MB || 512}mb` }))

  // CORS config: when serving frontend from same origin, allow all; otherwise use allowlist
  const corsOriginsEnv = process.env.CORS_ORIGIN || ''
  const allowedOrigins = corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
  const allowAllOrigins = process.env.SERVE_FRONTEND === '1' || allowedOrigins.length === 0

  app.use(
    cors({
      origin: allowAllOrigins ? true : (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        callback(new Error('Not allowed by CORS'))
      },
      credentials: true,
      exposedHeaders: ['Accept-Ranges', 'Content-Length', 'Content-Range', 'Content-Type'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Range']
    })
  )
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  // Simple rate limiters for auth and upload
  const authLimiter = new RateLimiterMemory({ points: 10, duration: 60 })
  const uploadLimiter = new RateLimiterMemory({ points: 5, duration: 60 })

  app.use('/api/auth', async (req, res, next) => {
    try { await authLimiter.consume(req.ip || 'ip'); next() } catch { res.status(429).json({ error: 'Too many requests' }) }
  })
  app.use('/api/books/upload', async (req, res, next) => {
    try { await uploadLimiter.consume(req.ip || 'ip'); next() } catch { res.status(429).json({ error: 'Too many uploads' }) }
  })

  // Routes
  app.use('/api/auth', authRoutes)
  app.use('/api/books', booksRoutes)
  app.use('/api/tags', tagsRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/audit', auditRoutes)
  app.use('/api/account', accountRoutes)

  // Health
  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  // Debug Info (temporary)
  app.get('/api/debug', (_req, res) => res.json({
    env: process.env.NODE_ENV,
    serve_frontend: process.env.SERVE_FRONTEND,
    cors_origin: process.env.CORS_ORIGIN,
    cwd: process.cwd(),
    files: fs.readdirSync(process.cwd()).slice(0, 5)
  }))

  // Static read-only assets
  app.use('/thumbnails', authRequired(), express.static(path.resolve('storage/thumbnails')))
  app.use('/previews', authRequired(), express.static(path.resolve('storage/previews')))

  // Serve built frontend (single-port deploy)
  if (process.env.SERVE_FRONTEND === '1') {
    // Search for frontend distribution in common locations
    const possiblePaths = [
      path.resolve(process.cwd(), 'public'),
      path.resolve(process.cwd(), 'frontend', 'dist'),
      path.resolve(process.cwd(), '..', 'frontend', 'dist'),
      path.resolve(process.cwd(), 'dist')
    ]
    const distDir = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0]

    if (fs.existsSync(distDir)) {
      // Serve static files with explicit MIME type and cache control for the worker
      app.use(express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.mjs')) {
            res.set('Content-Type', 'application/javascript')
            // Disable caching for the worker to ensure it always updates after a fix
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            res.set('Pragma', 'no-cache')
            res.set('Expires', '0')
          }
        }
      }))

      // Fallback: serve index.html for all non-API routes (Angular routing)
      app.get('*', (req, res) => {
        // Only serve index for non-file requests to avoid infinite recursion for missing assets
        if (req.path.includes('.')) {
          return res.status(404).send('Not found')
        }
        const index = path.join(distDir, 'index.html')
        if (fs.existsSync(index)) {
          res.sendFile(index)
        } else {
          res.status(404).send('Frontend not found')
        }
      })
    } else {
      // Frontend directory not found - show API message
      app.get('/', (_req, res) => {
        res.status(200).send('Manga Shelf API. SERVE_FRONTEND=1 but dist not found at: ' + distDir)
      })
    }
  } else {
    // API-only mode - no frontend serving
    app.get('/', (_req, res) => {
      res.status(200).send('Manga Shelf API. Try GET /api/health')
    })
  }

  return app
}
