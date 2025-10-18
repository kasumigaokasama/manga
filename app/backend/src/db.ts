import DatabaseDriver from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import path from 'node:path'
import fs from 'node:fs'
import type { Database } from './types.js'

const storageRoot = process.env.STORAGE_DIR || path.resolve(process.cwd(), '..', '..', 'storage')
const dbDir = path.join(storageRoot, 'db')
const dbFile = path.join(dbDir, 'manga-shelf.sqlite')

export function ensureStorage() {
  const dirs = [
    storageRoot,
    path.join(storageRoot, 'originals'),
    path.join(storageRoot, 'pages'),
    path.join(storageRoot, 'thumbnails'),
    path.join(storageRoot, 'previews'),
    dbDir
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

// Ensure directories exist before opening DB to avoid import-order issues
ensureStorage()

export const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: new DatabaseDriver(dbFile)
  })
})

export async function migrateAndSeed() {
  // Create tables if not exist
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('email', 'text', (c) => c.notNull().unique())
    .addColumn('passwordHash', 'text', (c) => c.notNull())
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('createdAt', 'text', (c) => c.notNull().defaultTo(new Date().toISOString()))
    .execute()

  await db.schema
    .createTable('books')
    .ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('author', 'text')
    .addColumn('format', 'text', (c) => c.notNull())
    .addColumn('language', 'text')
    .addColumn('pageCount', 'integer')
    .addColumn('filePath', 'text', (c) => c.notNull())
    .addColumn('coverPath', 'text')
    .addColumn('previewPath', 'text')
    .addColumn('createdAt', 'text', (c) => c.notNull().defaultTo(new Date().toISOString()))
    .addColumn('updatedAt', 'text', (c) => c.notNull().defaultTo(new Date().toISOString()))
    .addColumn('deleted', 'integer', (c) => c.notNull().defaultTo(0))
    .execute()

  await db.schema
    .createTable('tags')
    .ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull().unique())
    .execute()

  await db.schema
    .createTable('book_tags')
    .ifNotExists()
    .addColumn('bookId', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('tagId', 'integer', (c) => c.notNull().references('tags.id'))
    .execute()

  await db.schema
    .createTable('reading_progress')
    .ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('userId', 'integer', (c) => c.notNull().references('users.id'))
    .addColumn('bookId', 'integer', (c) => c.notNull().references('books.id'))
    .addColumn('page', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('percent', 'real', (c) => c.notNull().defaultTo(0))
    .addColumn('updatedAt', 'text', (c) => c.notNull().defaultTo(new Date().toISOString()))
    .execute()

  // Seed users if none (dev only)
  const userCount = await db.selectFrom('users').select((eb) => eb.fn.countAll().as('c')).executeTakeFirst()
  if ((process.env.NODE_ENV || 'development') !== 'production' && (!userCount || (userCount as any).c === 0)) {
    const bcrypt = await import('bcrypt')
    const adminHash = await bcrypt.hash('ChangeThis123!', 10)
    const friendHash = await bcrypt.hash('ChangeThis123!', 10)
    await db
      .insertInto('users')
      .values([
        {
          email: 'admin@example.com',
          passwordHash: adminHash,
          role: 'admin',
          createdAt: new Date().toISOString()
        },
        {
          email: 'friend1@example.com',
          passwordHash: friendHash,
          role: 'reader',
          createdAt: new Date().toISOString()
        },
        {
          email: 'friend2@example.com',
          passwordHash: friendHash,
          role: 'reader',
          createdAt: new Date().toISOString()
        }
      ])
      .onConflict((oc) => oc.column('email').doNothing())
      .execute()
  }

  // Dev convenience: if no books exist, auto-import sample.pdf from repo root (dev only)
  try {
    const bookCount = await db.selectFrom('books').select((eb) => eb.fn.countAll().as('c')).executeTakeFirst()
    const hasNoBooks = !bookCount || (bookCount as any).c === 0
    const repoRoot = path.resolve(process.cwd(), '..', '..')
    const sampleSrc = path.join(repoRoot, 'sample.pdf')
    if ((process.env.NODE_ENV || 'development') !== 'production' && hasNoBooks && fs.existsSync(sampleSrc)) {
      // Copy into storage/originals with a safe unique name
      let baseName = 'sample.pdf'
      let dst = path.join(paths.originals, baseName)
      let i = 1
      while (fs.existsSync(dst)) {
        baseName = `sample-${i++}.pdf`
        dst = path.join(paths.originals, baseName)
      }
      fs.copyFileSync(sampleSrc, dst)
      const now = new Date().toISOString()
      await db
        .insertInto('books')
        .values({
          title: 'Sample PDF',
          author: null,
          language: null,
          format: 'pdf',
          filePath: dst,
          coverPath: null,
          previewPath: null,
          pageCount: null,
          createdAt: now,
          updatedAt: now,
          deleted: 0
        })
        .execute()
    }
  } catch (e) {
    // Best-effort; ignore any errors to avoid blocking startup in production
  }
}

export const paths = {
  root: storageRoot,
  originals: path.join(storageRoot, 'originals'),
  pages: path.join(storageRoot, 'pages'),
  thumbnails: path.join(storageRoot, 'thumbnails'),
  previews: path.join(storageRoot, 'previews')
}
