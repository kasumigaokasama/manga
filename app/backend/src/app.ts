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
  app.use(helmet())
  app.use(express.json({ limit: `${process.env.MAX_UPLOAD_MB || 512}mb` }))
  const corsOriginsEnv = process.env.CORS_ORIGIN || 'http://localhost:4200,http://localhost:4300'
  const allowedOrigins = corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
  app.use(
    cors({
      origin: (origin, callback) => {
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

  // Root helper
  app.get('/', (_req, res) => {
    res.status(200).send('Manga Shelf API. Try GET /api/health')
  })

  // Static read-only assets
  app.use('/thumbnails', authRequired(), express.static(path.resolve('storage/thumbnails')))
  app.use('/previews', authRequired(), express.static(path.resolve('storage/previews')))

  // Optionally serve built frontend (single-port deploy)
  if (process.env.SERVE_FRONTEND === '1') {
    const distDir = path.resolve(process.cwd(), '..', 'frontend', 'dist')
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir))
      app.get('*', (_req, res) => {
        const index = path.join(distDir, 'index.html')
        res.sendFile(index)
      })
    }
  }

  return app
}
