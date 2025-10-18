import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authRequired } from '../middleware/auth.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'
const router = Router()

const LoginSchema = z.object({
  // Erzwinge echte E-Mail-Adressen, alles wird intern in Kleinbuchstaben gespeichert.
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(6)
})

router.post('/login', async (req, res) => {
  // In production, require a strong JWT secret
  if ((process.env.NODE_ENV || 'development') === 'production') {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 32) {
      return res.status(500).json({ error: 'Server misconfigured: weak JWT secret' })
    }
  }
  const parse = LoginSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' })
  const { email, password } = parse.data
  const user = await db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst()
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const accessToken = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  // Also set an HttpOnly cookie for same-origin deployments
  try {
    const secure = (process.env.NODE_ENV || 'development') === 'production'
    const cookie = [
      `ms_token=${accessToken}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      secure ? 'Secure' : ''
    ].filter(Boolean).join('; ')
    res.setHeader('Set-Cookie', cookie)
  } catch {}
  const cookieOnly = ((process.env.AUTH_COOKIE_ONLY || '').toLowerCase() === '1' || (process.env.AUTH_COOKIE_ONLY || '').toLowerCase() === 'true')
  const inProd = (process.env.NODE_ENV || 'development') === 'production'
  if (cookieOnly && inProd) {
    return res.json({ ok: true })
  }
  res.json({ accessToken })
})

router.get('/me', authRequired(), async (req, res) => {
  res.json({ user: req.user })
})

router.post('/logout', async (_req, res) => {
  const parts = ['ms_token=','Path=/','HttpOnly','SameSite=Lax','Max-Age=0']
  if ((process.env.NODE_ENV || 'development') === 'production') parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
  res.json({ ok: true })
})

export default router
