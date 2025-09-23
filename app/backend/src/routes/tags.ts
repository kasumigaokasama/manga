import { Router } from 'express'
import { db } from '../db'

const router = Router()

router.get('/', async (_req, res) => {
  const tags = await db.selectFrom('tags').selectAll().orderBy('name', 'asc').execute()
  res.json({ tags })
})

export default router

