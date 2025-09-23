import { Router } from 'express'
import { authRequired } from '../middleware/auth'
import { db } from '../db'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { appendAudit } from '../util/audit'

const router = Router()

router.use(authRequired(['admin']))

router.get('/', async (_req, res) => {
  const users = await db.selectFrom('users').select(['id', 'email', 'role', 'createdAt']).orderBy('createdAt', 'desc').execute()
  res.json({ users })
})

const CreateUser = z.object({
  email: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['admin', 'editor', 'reader'])
})

router.post('/', async (req, res) => {
  const parse = CreateUser.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' })
  const { email, password, role } = parse.data
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date().toISOString()
    const ins = await db.insertInto('users').values({ email, passwordHash, role, createdAt: now }).returning(['id', 'email', 'role', 'createdAt']).executeTakeFirstOrThrow()
    appendAudit('user_create', { adminId: req.user!.sub, userId: (ins as any).id, email, role })
    res.status(201).json({ user: ins })
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (msg.toLowerCase().includes('unique')) return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: 'Failed to create user' })
  }
})

const UpdateUser = z.object({
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'editor', 'reader']).optional()
})

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const parse = UpdateUser.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' })
  const updates: any = {}
  if (parse.data.role) updates.role = parse.data.role
  if (parse.data.password) updates.passwordHash = await bcrypt.hash(parse.data.password, 10)
  if (!Object.keys(updates).length) return res.json({ ok: true })
  await db.updateTable('users').set(updates).where('id', '=', id).execute()
  appendAudit('user_update', { adminId: req.user!.sub, userId: id, fields: Object.keys(updates) })
  res.json({ ok: true })
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user!.sub) return res.status(400).json({ error: 'Cannot delete self' })
  await db.deleteFrom('users').where('id', '=', id).execute()
  appendAudit('user_delete', { adminId: req.user!.sub, userId: id })
  res.json({ ok: true })
})

export default router
