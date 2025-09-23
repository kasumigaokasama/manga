import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { z } from 'zod'
import slugify from 'slugify'
import unzipper from 'unzipper'
import sharp from 'sharp'
import { db, paths } from '../db'
import { authRequired } from '../middleware/auth'
import { appendAudit } from '../util/audit'

const router = Router()

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, paths.originals),
    filename: (_req, file, cb) => {
      const base = path.parse(file.originalname).name
      const ext = path.extname(file.originalname).toLowerCase()
      const safe = slugify(base, { lower: true, strict: true }) || 'upload'
      let name = `${safe}${ext}`
      let i = 1
      while (fs.existsSync(path.join(paths.originals, name))) {
        name = `${safe}-${i++}${ext}`
      }
      cb(null, name)
    }
  })
})

const QuerySchema = z.object({
  query: z.string().optional(),
  format: z.string().optional(),
  tag: z.string().optional(),
  lang: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.string().optional()
})

router.get('/', async (req, res) => {
  const { query, format, tag, lang, page = 1, limit = 24, sort = 'createdAt.desc' } = QuerySchema.parse(req.query)
  let q = db.selectFrom('books').selectAll().where('deleted', '=', 0)
  if (query) q = q.where('title', 'like', `%${query}%`)
  if (format) q = q.where('format', '=', format)
  if (lang) q = q.where('language', '=', lang)
  if (tag) {
    q = q
      .leftJoin('book_tags as bt', 'bt.bookId', 'books.id')
      .leftJoin('tags as t', 't.id', 'bt.tagId')
      .where('t.name', '=', tag)
      .selectAll('books')
  }
  const [col, dir] = sort.split('.')
  const orderCol = ['createdAt', 'title', 'updatedAt'].includes(col) ? (col as any) : 'createdAt'
  const orderDir = dir === 'asc' ? 'asc' : 'desc'
  const items = await q.orderBy(orderCol, orderDir).limit(limit).offset((page - 1) * limit).execute()
  res.json({ items })
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const book = await db.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirst()
  if (!book) return res.status(404).json({ error: 'Not found' })
  const tags = await db
    .selectFrom('book_tags as bt')
    .innerJoin('tags as t', 't.id', 'bt.tagId')
    .select(['t.name'])
    .where('bt.bookId', '=', id)
    .execute()
  res.json({ book, tags: tags.map(t => t.name) })
})

router.get('/:id/stream', async (req, res) => {
  const id = Number(req.params.id)
  const book = await db.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirst()
  if (!book) return res.status(404).end()
  const file = book.filePath
  if (!fs.existsSync(file)) return res.status(410).end()
  const stat = fs.statSync(file)
  const range = req.headers.range
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1
    const chunkSize = end - start + 1
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentTypeForPath(file)
    })
    fs.createReadStream(file, { start, end }).pipe(res)
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': contentTypeForPath(file) })
    fs.createReadStream(file).pipe(res)
  }
})

router.get('/:id/pages/:n', async (req, res) => {
  const id = Number(req.params.id)
  const n = Number(req.params.n)
  const dir = path.join(paths.pages, String(id))
  const file = path.join(dir, `${n}.jpg`)
  if (!fs.existsSync(file)) return res.status(404).end()
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
  res.sendFile(file)
})

const UploadSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  language: z.string().optional(),
  // tags: comma-separated
  tags: z.string().optional()
})

function adminTokenOrRole(roles: Array<'admin'|'editor'|'reader'>) {
  const adminToken = process.env.ADMIN_TOKEN
  return (req: any, res: any, next: any) => {
    if (adminToken && req.headers['x-admin-token'] === adminToken) {
      req.user = { sub: 0, email: 'admin-token', role: 'admin' }
      return next()
    }
    return authRequired(roles)(req, res, next)
  }
}

router.post('/upload', adminTokenOrRole(['admin', 'editor']), upload.single('file'), async (req, res) => {
  const body = UploadSchema.safeParse(req.body)
  if (!req.file || !body.success) {
    return res.status(400).json({ error: 'Invalid payload or file missing' })
  }
  const filePath = path.join(paths.originals, req.file.filename)
  const ext = path.extname(req.file.originalname).toLowerCase()
  let format: 'pdf' | 'epub' | 'cbz' | 'images' = 'images'
  if (['.pdf'].includes(ext)) format = 'pdf'
  else if (['.epub'].includes(ext)) format = 'epub'
  else if (['.cbz', '.zip'].includes(ext)) format = 'cbz'

  // Magic-byte validation (basic)
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(8)
    fs.readSync(fd, buf, 0, 8, 0)
    fs.closeSync(fd)
    const isPdf = buf.slice(0, 4).toString() === '%PDF'
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b
    if (format === 'pdf' && !isPdf) throw new Error('Not a PDF file')
    if ((format === 'cbz' || format === 'images' || format === 'epub') && !(isZip || format === 'images')) {
      throw new Error('Expected ZIP-based container')
    }
  } catch (e: any) {
    return res.status(400).json({ error: 'Magic-byte validation failed', detail: String(e?.message || e) })
  }

  // Insert book row
  const now = new Date().toISOString()
  const inserted = await db
    .insertInto('books')
    .values({
      title: body.data.title,
      author: body.data.author ?? null,
      language: body.data.language ?? null,
      format,
      filePath,
      coverPath: null,
      previewPath: null,
      createdAt: now,
      updatedAt: now,
      deleted: 0
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  try {
    if (format === 'cbz' || format === 'zip') {
      await extractCbzToPages(filePath, inserted.id)
      const coverFs = path.join(paths.thumbnails, `${inserted.id}.jpg`)
      const firstPage = path.join(paths.pages, String(inserted.id), '1.jpg')
      if (fs.existsSync(firstPage)) {
        await sharp(firstPage).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(coverFs)
        const coverPath = `/thumbnails/${inserted.id}.jpg`
        await db.updateTable('books').set({ coverPath }).where('id', '=', inserted.id).execute()
      }
    } else if (format === 'pdf') {
      // Try to generate cover via pdftoppm if available
      try {
        const tmpOut = path.join(paths.previews, `pdf-${inserted.id}`)
        await execFilePromise('pdftoppm', ['-f', '1', '-l', '1', '-singlefile', '-jpeg', filePath, tmpOut])
        const jpg = `${tmpOut}.jpg`
        if (fs.existsSync(jpg)) {
          const coverFs = path.join(paths.thumbnails, `${inserted.id}.jpg`)
          await sharp(jpg).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(coverFs)
          const coverPath = `/thumbnails/${inserted.id}.jpg`
          await db.updateTable('books').set({ coverPath }).where('id', '=', inserted.id).execute()
        }
      } catch {}
    } else if (format === 'images') {
      // If a zip-of-images was uploaded but not .cbz/.zip, treat as original images folder (user can pre-arrange)
    } else if (format === 'epub') {
      try {
        const meta = await extractEpubMetaAndCover(filePath, inserted.id)
        const updates: any = {}
        if (meta.title && !body.data.title) updates.title = meta.title
        if (meta.author) updates.author = meta.author
        if (meta.language) updates.language = meta.language
        if (meta.coverPath) updates.coverPath = meta.coverPath
        if (Object.keys(updates).length) {
          await db.updateTable('books').set(updates).where('id', '=', inserted.id).execute()
        }
      } catch (e) {
        console.warn('EPUB metadata/cover extraction failed:', e)
      }
    }

    // Handle tags if provided
    const tags = (body.data.tags || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20)
    if (tags.length) {
      const ids = await upsertTags(tags)
      for (const tagId of ids) {
        await db.insertInto('book_tags').values({ bookId: inserted.id, tagId }).execute()
      }
    }
    appendAudit('book_upload', { userId: req.user?.sub ?? 0, bookId: inserted.id, title: body.data.title, format })
  } catch (e) {
    console.error('Import error', e)
  }

  res.status(201).json({ id: inserted.id })
})

router.post('/:id/progress', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  const { page = 0, percent = 0 } = req.body ?? {}
  const userId = req.user!.sub
  const now = new Date().toISOString()
  const existing = await db
    .selectFrom('reading_progress')
    .selectAll()
    .where('userId', '=', userId)
    .where('bookId', '=', id)
    .executeTakeFirst()
  if (existing) {
    await db.updateTable('reading_progress').set({ page, percent, updatedAt: now }).where('id', '=', existing.id).execute()
  } else {
    await db.insertInto('reading_progress').values({ userId, bookId: id, page, percent, updatedAt: now }).execute()
  }
  res.json({ ok: true })
})

router.get('/:id/progress', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  const userId = req.user!.sub
  const prog = await db
    .selectFrom('reading_progress')
    .selectAll()
    .where('userId', '=', userId)
    .where('bookId', '=', id)
    .executeTakeFirst()
  res.json({ progress: prog || null })
})

router.delete('/:id', adminTokenOrRole(['admin']), async (req, res) => {
  const id = Number(req.params.id)
  await db.updateTable('books').set({ deleted: 1, updatedAt: new Date().toISOString() }).where('id', '=', id).execute()
  appendAudit('book_delete', { userId: req.user?.sub ?? 0, bookId: id })
  res.json({ ok: true })
})

async function extractCbzToPages(zipPath: string, bookId: number) {
  const outDir = path.join(paths.pages, String(bookId))
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  // Extract all files
  await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: outDir })).promise()
  // Normalize images to sequential JPGs
  const files = fs
    .readdirSync(outDir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort(new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare)
  let index = 1
  for (const f of files) {
    const src = path.join(outDir, f)
    const dst = path.join(outDir, `${index++}.jpg`)
    await sharp(src).jpeg({ quality: 78, progressive: true }).toFile(dst)
    if (src !== dst) fs.unlinkSync(src)
  }
  // Update pageCount in DB
  await db.updateTable('books').set({ pageCount: index - 1, updatedAt: new Date().toISOString() }).where('id', '=', bookId).execute()
}

function contentTypeForPath(p: string) {
  if (p.endsWith('.pdf')) return 'application/pdf'
  if (p.endsWith('.epub')) return 'application/epub+zip'
  if (p.endsWith('.cbz') || p.endsWith('.zip')) return 'application/zip'
  return 'application/octet-stream'
}

export default router

function execFilePromise(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(err) : resolve()))
  })
}

async function upsertTags(names: string[]) {
  const ids: number[] = []
  for (const n of names) {
    const existing = await db.selectFrom('tags').selectAll().where('name', '=', n).executeTakeFirst()
    if (existing) {
      ids.push(existing.id as unknown as number)
    } else {
      const ins = await db.insertInto('tags').values({ name: n }).returningAll().executeTakeFirstOrThrow()
      ids.push(ins.id as unknown as number)
    }
  }
  return ids
}

async function extractEpubMetaAndCover(epubPath: string, bookId: number): Promise<{ title?: string; author?: string; language?: string; coverPath?: string }>
{
  // Open ZIP and read META-INF/container.xml
  const opened = await (unzipper as any).Open.file(epubPath)
  const getEntry = (name: string) => opened.files.find((f: any) => f.path.replace(/\\/g,'/') === name)
  const container = getEntry('META-INF/container.xml')
  if (!container) throw new Error('container.xml not found')
  const containerXml = (await container.buffer()).toString('utf-8')
  const opfPathMatch = containerXml.match(/full-path\s*=\s*"([^"]+)"/i)
  if (!opfPathMatch) throw new Error('OPF path not found')
  const opfPath = opfPathMatch[1]
  const opfEntry = getEntry(opfPath)
  if (!opfEntry) throw new Error('OPF not found')
  const opfXml = (await opfEntry.buffer()).toString('utf-8')
  const meta: any = {}
  meta.title = matchTagText(opfXml, 'dc:title') || undefined
  meta.author = matchTagText(opfXml, 'dc:creator') || undefined
  meta.language = matchTagText(opfXml, 'dc:language') || undefined
  // Find cover image
  // Option 1: <meta name="cover" content="cover-id"/>
  const coverId = (opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["'][^>]*\/>/i) || [])[1]
  let coverHref: string | undefined
  if (coverId) {
    const re = new RegExp(`<item[^>]*id=["']${escapeRegExp(coverId)}["'][^>]*href=["']([^"']+)["']`, 'i')
    coverHref = (opfXml.match(re) || [])[1]
  }
  // Option 2: <item properties="cover-image" href="..."/>
  if (!coverHref) {
    coverHref = (opfXml.match(/<item[^>]*properties=["'][^"']*cover-image[^"']*["'][^>]*href=["']([^"']+)["']/i) || [])[1]
  }
  if (coverHref) {
    const base = opfPath.split('/').slice(0, -1).join('/')
    const normalized = base ? `${base}/${coverHref}` : coverHref
    const coverEntry = getEntry(normalized)
    if (coverEntry) {
      const buf = await coverEntry.buffer()
      const coverFs = path.join(paths.thumbnails, `${bookId}.jpg`)
      await sharp(buf).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(coverFs)
      meta.coverPath = `/thumbnails/${bookId}.jpg`
    }
  }
  return meta
}

function matchTagText(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'))
  return m ? m[1].trim() : null
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
