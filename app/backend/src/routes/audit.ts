import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { authRequired } from '../middleware/auth.js'

const router = Router()

router.get('/', authRequired(['admin']), async (req, res) => {
  const limit = Math.max(1, Math.min(2000, Number(req.query.limit) || 200))
  const file = path.resolve('storage/db/audit.log')
  if (!fs.existsSync(file)) return res.json({ events: [] })
  try {
    const data = fs.readFileSync(file, 'utf-8')
    const lines = data.trim().split(/\r?\n/)
    const slice = lines.slice(-limit)
    const events = slice.map((l) => { try { return JSON.parse(l) } catch { return { raw: l } } })
    res.json({ events })
  } catch (e) {
    res.status(500).json({ error: 'Failed to read audit log' })
  }
})

export default router
