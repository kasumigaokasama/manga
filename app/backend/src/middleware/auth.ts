import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { JwtPayload, Role } from '../types.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieOnly = ((process.env.AUTH_COOKIE_ONLY || '').toLowerCase() === '1' || (process.env.AUTH_COOKIE_ONLY || '').toLowerCase() === 'true')
  const inProd = (process.env.NODE_ENV || 'development') === 'production'
  const cookie = req.headers['cookie']
  const readCookie = () => {
    if (typeof cookie === 'string') {
      const parts = cookie.split(';')
      for (const p of parts) {
        const [k, v] = p.trim().split('=')
        if (k === 'ms_token' && v) return decodeURIComponent(v)
      }
    }
    return null
  }
  if (cookieOnly && inProd) {
    return readCookie()
  }
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  // Limited support for token in query for PDF/image streaming routes to improve cross-origin compatibility in dev
  try {
    const p = req.path || ''
    const isStream = /^\/api\/books\/\d+\/(stream|pages\/)/.test(p)
    if (isStream) {
      const q: any = req.query || {}
      const t = (q.token || q.access_token) as string | undefined
      if (t && typeof t === 'string') return t
    }
  } catch {}
  return readCookie()
}

export function authRequired(roles?: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      if (!decoded || typeof decoded === 'string') {
        return res.status(401).json({ error: 'Invalid token' })
      }
      const raw = decoded as Record<string, unknown>
      if (
        typeof raw.sub !== 'number' ||
        typeof raw.email !== 'string' ||
        (raw.role !== 'admin' && raw.role !== 'editor' && raw.role !== 'reader')
      ) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      const payload: JwtPayload = { sub: raw.sub, email: raw.email, role: raw.role }
      if (roles && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      req.user = payload
      next()
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}

