import { Router } from 'express'
import { db } from '../db.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

router.get('/', authRequired(), async (_req, res) => {
  const tags = await db.selectFrom('tags').selectAll().orderBy('name', 'asc').execute()
  res.json({ tags })
})

export default router

