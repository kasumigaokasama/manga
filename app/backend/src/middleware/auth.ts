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

export function authRequired(roles?: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = auth.slice(7)
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

