import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'node:path'
import authRoutes from './routes/auth.js'
import booksRoutes from './routes/books.js'
import tagsRoutes from './routes/tags.js'
import usersRoutes from './routes/users.js'
import auditRoutes from './routes/audit.js'
import accountRoutes from './routes/account.js'
import { RateLimiterMemory } from 'rate-limiter-flexible'

export function createApp() {
  const app = express()
  app.use(helmet())
  app.use(express.json({ limit: `${process.env.MAX_UPLOAD_MB || 512}mb` }))
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
      credentials: true
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
  app.use('/thumbnails', express.static(path.resolve('storage/thumbnails')))
  app.use('/previews', express.static(path.resolve('storage/previews')))

  return app
}
