import { Router } from 'express'
import { authRequired } from '../middleware/auth'
import { db } from '../db'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { appendAudit } from '../util/audit'

const router = Router()

const ChangePassword = z.object({ currentPassword: z.string().min(6), newPassword: z.string().min(6) })

router.patch('/password', authRequired(), async (req, res) => {
  const parse = ChangePassword.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' })
  const { currentPassword, newPassword } = parse.data
  const user = await db.selectFrom('users').selectAll().where('id', '=', req.user!.sub).executeTakeFirst()
  if (!user) return res.status(404).json({ error: 'User not found' })
  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Current password incorrect' })
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db.updateTable('users').set({ passwordHash }).where('id', '=', user.id as any).execute()
  appendAudit('password_change', { userId: req.user!.sub })
  res.json({ ok: true })
})

export default router

