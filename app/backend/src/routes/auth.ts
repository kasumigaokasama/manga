import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authRequired } from '../middleware/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'
const router = Router()

const LoginSchema = z.object({
  // Akzeptiert einfache Kennung wie 'adminexample.com' (kein echtes @ notwendig)
  email: z.string().min(3),
  password: z.string().min(6)
})

router.post('/login', async (req, res) => {
  const parse = LoginSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' })
  const { email, password } = parse.data
  const user = await db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst()
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const accessToken = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ accessToken })
})

router.get('/me', authRequired(), async (req, res) => {
  res.json({ user: req.user })
})

export default router
