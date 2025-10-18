import { ensureStorage, migrateAndSeed } from './db.js'
import { createApp } from './app.js'

const PORT = Number(process.env.PORT || 3000)

ensureStorage()
migrateAndSeed().then(() => {
  if ((process.env.NODE_ENV || 'development') === 'production') {
    const sec = process.env.JWT_SECRET || ''
    if (!sec || sec.length < 32) {
      console.error('FATAL: JWT_SECRET must be set to a strong value (>=32 chars) in production')
      process.exit(1)
    }
  }
  const app = createApp()
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
})
