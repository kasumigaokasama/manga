import { ensureStorage, migrateAndSeed } from './db'
import { createApp } from './app'

const PORT = Number(process.env.PORT || 3000)

ensureStorage()
migrateAndSeed().then(() => {
  const app = createApp()
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
})
