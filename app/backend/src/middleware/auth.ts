import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JwtPayload, Role } from '../types'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  const altHeader = req.headers['x-access-token']
  if (typeof altHeader === 'string') {
    return altHeader
  }
  const qToken = (req.query?.token ?? req.query?.access_token) as unknown
  if (Array.isArray(qToken)) {
    return qToken[0] ?? null
  }
  if (typeof qToken === 'string') {
    // Verhindere, dass die Token-Query später weitergereicht wird
    delete (req.query as any).token
    delete (req.query as any).access_token
    return qToken
  }
  return null
}

export function authRequired(roles?: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
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

