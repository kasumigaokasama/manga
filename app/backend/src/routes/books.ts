import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { z } from 'zod'
import slugifyModule from 'slugify'
const slugify: any = (slugifyModule as any).default ?? (slugifyModule as any)
import unzipper from 'unzipper'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { XMLParser } from 'fast-xml-parser'
import { sql } from 'kysely'
import { db, paths } from '../db.js'
import { authRequired } from '../middleware/auth.js'
import { appendAudit } from '../util/audit.js'
import type { Role, BookFormat } from '../types.js'

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
  format: z.enum(['pdf', 'epub', 'cbz', 'images']).optional(),
  tag: z.string().optional(),
  lang: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.string().optional()
})

router.get('/', authRequired(), async (req, res) => {
  const { query, format, tag, lang, page = 1, limit = 24, sort = 'createdAt.desc' } = QuerySchema.parse(req.query)
  const take = Math.max(1, Math.min(limit, 60))
  const currentPage = Math.max(1, page)

  let q = db.selectFrom('books').selectAll().where('deleted', '=', 0)
  if (query) q = q.where('title', 'like', `%${query}%`)
  if (format) q = q.where('format', '=', format as BookFormat)
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

  if (orderCol === 'title') {
    q = q.orderBy(sql`title collate nocase`, orderDir)
  } else {
    q = q.orderBy(orderCol, orderDir)
  }

  const rows = await q
    .limit(take + 1)
    .offset((currentPage - 1) * take)
    .execute()

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows

  res.json({ items, pagination: { page: currentPage, limit: take, hasMore } })
})

router.get('/languages', authRequired(), async (_req, res) => {
  const rows = await db
    .selectFrom('books')
    .select('language')
    .where('deleted', '=', 0)
    .where('language', 'is not', null)
    .groupBy('language')
    .orderBy('language', 'asc')
    .execute()
  const languages = rows.map((r) => r.language).filter((v): v is string => typeof v === 'string' && v.length > 0)
  res.json({ languages })
})

router.get('/:id', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })
  let book = await db
    .selectFrom('books')
    .selectAll()
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!book) return res.status(404).json({ error: 'Not found' })

  // Auto-heal: if file is actually a PDF but format was misdetected, fix it on read.
  try {
    const file = book.filePath
    if (fs.existsSync(file)) {
      const fd = fs.openSync(file, 'r')
      const buf = Buffer.alloc(4)
      fs.readSync(fd, buf, 0, 4, 0)
      fs.closeSync(fd)
      const isPdf = buf.toString() === '%PDF'
      if (isPdf && book.format !== 'pdf') {
        const updates: Record<string, any> = { format: 'pdf', updatedAt: new Date().toISOString() }
        // Try to set pageCount via pdf-lib
        try {
          const pdfBytes = fs.readFileSync(file)
          const pdfDoc = await PDFDocument.load(pdfBytes)
          updates.pageCount = pdfDoc.getPageCount()
        } catch { }
        await db.updateTable('books').set(updates).where('id', '=', id).execute()
        book = { ...book, ...updates }
      }
      // If still no cover, create a placeholder so the UI shows a cover
      if (!book.coverPath) {
        try {
          await generatePlaceholderCover(id)
          const coverPath = `/thumbnails/${id}.jpg`
          const previewPath = `/previews/${id}.jpg`
          await db.updateTable('books').set({ coverPath, previewPath, updatedAt: new Date().toISOString() }).where('id', '=', id).execute()
          book.coverPath = coverPath
          book.previewPath = previewPath
        } catch { }
      }
    }
  } catch { }
  const tags = await db
    .selectFrom('book_tags as bt')
    .innerJoin('tags as t', 't.id', 'bt.tagId')
    .select(['t.name'])
    .where('bt.bookId', '=', id)
    .execute()
  res.json({ book, tags: tags.map(t => t.name) })
})

router.get('/:id/stream', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end()
  const book = await db
    .selectFrom('books')
    .selectAll()
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!book) return res.status(404).end()
  const file = book.filePath
  if (!fs.existsSync(file)) return res.status(410).end()
  const stat = fs.statSync(file)
  const range = req.headers.range
  const contentType = contentTypeForPath(file)
  // For EPUB, prefer forcing a download with a sensible filename
  const extraHeaders: Record<string, string> = {}
  if (book.format === 'epub') {
    const baseName = slugify(path.parse(book.filePath).name || `book-${book.id}`, { lower: true, strict: true })
    extraHeaders['Content-Disposition'] = `attachment; filename="${baseName}.epub"`
  }
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
    let start = Number.parseInt(startStr, 10)
    let end = endStr ? Number.parseInt(endStr, 10) : stat.size - 1
    if (!Number.isFinite(start) || start < 0 || start >= stat.size) {
      res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end()
      return
    }
    if (!Number.isFinite(end) || end >= stat.size) end = stat.size - 1
    if (end < start) end = start
    const chunkSize = end - start + 1
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=0'
      , ...extraHeaders
    })
    fs.createReadStream(file, { start, end }).pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=0'
      , ...extraHeaders
    })
    fs.createReadStream(file).pipe(res)
  }
})

// HEAD for stream to allow clients to probe size/type without downloading
router.head('/:id/stream', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end()
  const book = await db
    .selectFrom('books')
    .selectAll()
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!book) return res.status(404).end()
  const file = book.filePath
  if (!fs.existsSync(file)) return res.status(410).end()
  const stat = fs.statSync(file)
  const contentType = contentTypeForPath(file)
  const headers: Record<string, string | number> = {
    'Content-Length': stat.size,
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=0'
  }
  if (book.format === 'epub') {
    const baseName = slugify(path.parse(book.filePath).name || `book-${book.id}`, { lower: true, strict: true })
    headers['Content-Disposition'] = `attachment; filename="${baseName}.epub"`
  }
  res.writeHead(200, headers)
  res.end()
})

// Explicit download route for original file (forces attachment)
router.get('/:id/download', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end()
  const book = await db
    .selectFrom('books')
    .selectAll()
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!book) return res.status(404).end()
  const file = book.filePath
  if (!fs.existsSync(file)) return res.status(410).end()
  const stat = fs.statSync(file)
  const contentType = contentTypeForPath(file)
  const baseName = slugify(path.parse(book.filePath).name || `book-${book.id}`, { lower: true, strict: true })
  res.writeHead(200, {
    'Content-Length': stat.size,
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${baseName}${path.extname(file)}"`,
    'Cache-Control': 'private, max-age=0'
  })
  fs.createReadStream(file).pipe(res)
})

router.get('/:id/pages/:n', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  const n = Number(req.params.n)
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(n) || n <= 0) {
    return res.status(400).end()
  }
  const exists = await db
    .selectFrom('books')
    .select(['id'])
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!exists) return res.status(404).end()
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

function adminTokenOrRole(roles: Role[]) {
  const adminToken = process.env.ADMIN_TOKEN
  return (req: any, res: any, next: any) => {
    const tok = req.headers['admin_token']
    const strong = typeof adminToken === 'string' && adminToken.length >= 32
    if (strong && tok === adminToken) {
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
  if (ext === '.pdf') format = 'pdf'
  else if (ext === '.epub') format = 'epub'
  else if (ext === '.cbz' || ext === '.zip') format = 'cbz'

  // Magic-byte validation (basic)
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(8)
    fs.readSync(fd, buf, 0, 8, 0)
    fs.closeSync(fd)
    const isPdf = buf.slice(0, 4).toString() === '%PDF'
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b
    // Override by magic: if it's a real PDF, treat it as PDF regardless of extension
    if (isPdf) format = 'pdf'
    // Validate by format
    if (format === 'pdf' && !isPdf) throw new Error('Not a PDF file')
    if ((format === 'cbz' || format === 'images' || format === 'epub') && !isZip) {
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
      title: body.data.title.trim(),
      author: body.data.author?.trim() ?? null,
      language: body.data.language?.trim() || null,
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
    const updates: Record<string, any> = {}

    if (format === 'cbz') {
      Object.assign(updates, await extractCbzToPages(filePath, inserted.id))
    } else if (format === 'pdf') {
      Object.assign(updates, await processPdf(filePath, inserted.id))
    } else if (format === 'epub') {
      try {
        const meta = await extractEpubMetaAndCover(filePath, inserted.id)
        if (!body.data.title && meta.title) updates.title = meta.title
        if (!body.data.author && meta.author) updates.author = meta.author
        if (!body.data.language && meta.language) updates.language = meta.language
        if (meta.coverPath) updates.coverPath = meta.coverPath
        if (meta.previewPath) updates.previewPath = meta.previewPath
      } catch (e) {
        console.warn('EPUB metadata/cover extraction failed:', e)
      }
    }

    const tags = (body.data.tags || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
    if (tags.length) {
      const ids = await upsertTags(tags)
      for (const tagId of ids) {
        await db.insertInto('book_tags').values({ bookId: inserted.id, tagId }).execute()
      }
    }

    if (Object.keys(updates).length) {
      updates.updatedAt = new Date().toISOString()
      await db.updateTable('books').set(updates).where('id', '=', inserted.id).execute()
    }

    appendAudit('book_upload', {
      userId: req.user?.sub ?? 0,
      bookId: inserted.id,
      title: body.data.title,
      format,
      language: body.data.language || null,
      tags
    })
  } catch (e) {
    console.error('Import error', e)
  }

  res.status(201).json({ id: inserted.id })
})

router.post('/:id/progress', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })
  const book = await db
    .selectFrom('books')
    .select(['id', 'pageCount'])
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!book) return res.status(404).json({ error: 'Not found' })
  const rawPage = Number(req.body?.page ?? 0)
  const userId = req.user!.sub
  const now = new Date().toISOString()
  const page = Number.isFinite(rawPage) ? Math.max(0, Math.floor(rawPage)) : 0

  let percent = typeof req.body?.percent === 'number' ? req.body.percent : 0
  if (!Number.isFinite(percent) || percent <= 0) {
    percent = calculatePercent(page, (book.pageCount as number | null) ?? null)
  } else {
    percent = clamp(percent, 0, 100)
  }

  const payload = { page, percent, updatedAt: now }

  const existing = await db
    .selectFrom('reading_progress')
    .selectAll()
    .where('userId', '=', userId)
    .where('bookId', '=', id)
    .executeTakeFirst()
  if (existing) {
    await db.updateTable('reading_progress').set(payload).where('id', '=', existing.id).execute()
  } else {
    await db.insertInto('reading_progress').values({ userId, bookId: id, ...payload }).execute()
  }
  res.json({ ok: true })
})

router.get('/:id/progress', authRequired(), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })
  const book = await db
    .selectFrom('books')
    .select(['id'])
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!book) return res.status(404).json({ error: 'Not found' })
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
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })
  await db.updateTable('books').set({ deleted: 1, updatedAt: new Date().toISOString() }).where('id', '=', id).execute()
  appendAudit('book_delete', { userId: req.user?.sub ?? 0, bookId: id })
  res.json({ ok: true })
})

// Admin maintenance: heal library (fix misdetected PDFs, ensure covers)
router.post('/heal', adminTokenOrRole(['admin']), async (_req, res) => {
  const books = await db.selectFrom('books').selectAll().where('deleted', '=', 0).execute()
  let fixed = 0
  for (const b of books as any[]) {
    try {
      if (!fs.existsSync(b.filePath)) continue
      const fd = fs.openSync(b.filePath, 'r')
      const buf = Buffer.alloc(4)
      fs.readSync(fd, buf, 0, 4, 0)
      fs.closeSync(fd)
      const isPdf = buf.toString() === '%PDF'
      const updates: Record<string, any> = {}
      if (isPdf && b.format !== 'pdf') {
        updates.format = 'pdf'
        try {
          const pdfBytes = fs.readFileSync(b.filePath)
          const pdfDoc = await PDFDocument.load(pdfBytes)
          updates.pageCount = pdfDoc.getPageCount()
        } catch { }
      }
      if (!b.coverPath) {
        try {
          await generatePlaceholderCover(b.id)
          updates.coverPath = `/thumbnails/${b.id}.jpg`
          updates.previewPath = `/previews/${b.id}.jpg`
        } catch { }
      }
      if (Object.keys(updates).length) {
        updates.updatedAt = new Date().toISOString()
        await db.updateTable('books').set(updates).where('id', '=', b.id).execute()
        fixed++
      }
    } catch { }
  }
  res.json({ ok: true, fixed })
})

async function extractCbzToPages(zipPath: string, bookId: number) {
  const outDir = path.join(paths.pages, String(bookId))
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })

  // Safely read zip entries without extracting arbitrary paths
  const opened = await (unzipper as any).Open.file(zipPath)
  const entries = opened.files.filter((f: any) => !f.type || f.type === 'File')
  // Only accept image-like names
  const imageEntries = entries.filter((f: any) => /\.(jpe?g|png|webp)$/i.test(path.basename(f.path)))
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  imageEntries.sort((a: any, b: any) => collator.compare(path.basename(a.path), path.basename(b.path)))

  let index = 1
  let firstProcessedPath: string | null = null
  const maxEnv = Number(process.env.MAX_PAGES_PER_BOOK || '2000')
  const maxPages = Number.isFinite(maxEnv) && maxEnv > 0 ? Math.min(Math.floor(maxEnv), 10000) : 2000
  for (const ent of imageEntries) {
    if (index > maxPages) break
    const buf = await ent.buffer()
    const dst = path.join(outDir, `${index}.jpg`)
    await sharp(buf).jpeg({ quality: 78, progressive: true }).toFile(dst)
    if (!firstProcessedPath) firstProcessedPath = dst
    index++
  }

  const count = Math.max(0, index - 1)
  const updates: Record<string, any> = { pageCount: count }
  if (firstProcessedPath) {
    Object.assign(updates, await generateThumbnails(firstProcessedPath, bookId))
  }
  return updates
}

async function processPdf(filePath: string, bookId: number) {
  const updates: Record<string, any> = {}
  try {
    const pdfBytes = fs.readFileSync(filePath)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    updates.pageCount = pdfDoc.getPageCount()
  } catch (err) {
    console.warn('PDF metadata extraction failed:', err)
  }

  try {
    const tmpOut = path.join(paths.previews, `pdf-${bookId}`)
    await execFilePromise('pdftoppm', ['-f', '1', '-l', '1', '-singlefile', '-jpeg', filePath, tmpOut])
    const jpg = `${tmpOut}.jpg`
    if (fs.existsSync(jpg)) {
      Object.assign(updates, await generateThumbnails(jpg, bookId))
      fs.unlinkSync(jpg)
    }
  } catch (err) {
    console.warn('pdftoppm not available, attempting sharp() PDF render')
    try {
      // Try to rasterize first PDF page via sharp (requires libvips with pdfium)
      const tmpJpg = path.join(paths.previews, `pdf-first-${bookId}.jpg`)
      await sharp(filePath, { density: 150, page: 0 }).jpeg({ quality: 85 }).toFile(tmpJpg)
      if (fs.existsSync(tmpJpg)) {
        Object.assign(updates, await generateThumbnails(tmpJpg, bookId))
        fs.unlinkSync(tmpJpg)
      }
    } catch (e2) {
      console.warn('sharp PDF render not available, generating placeholder cover instead')
      try {
        await generatePlaceholderCover(bookId)
        updates.coverPath = `/thumbnails/${bookId}.jpg`
        updates.previewPath = `/previews/${bookId}.jpg`
      } catch (e3) {
        console.warn('Placeholder cover generation failed:', e3)
      }
    }
  }

  return updates
}

async function generatePlaceholderCover(bookId: number) {
  const w = 768, h = 1152
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#F9D5E5"/>
        <stop offset="100%" stop-color="#ffffff"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="45%" font-family="Arial, Helvetica, sans-serif" font-size="180" fill="#0F2D5C" text-anchor="middle">PDF</text>
    <text x="50%" y="58%" font-family="Arial, Helvetica, sans-serif" font-size="48" fill="#0F2D5C" text-anchor="middle">Manga Shelf</text>
  </svg>`
  const buf = Buffer.from(svg)
  const previewJpg = path.join(paths.previews, `${bookId}.jpg`)
  const thumbJpg = path.join(paths.thumbnails, `${bookId}.jpg`)
  await sharp(buf).jpeg({ quality: 85 }).toFile(previewJpg)
  await sharp(previewJpg).resize(256, 384, { fit: 'cover' }).jpeg({ quality: 78, progressive: true }).toFile(thumbJpg)
}

async function extractEpubMetaAndCover(epubPath: string, bookId: number): Promise<{
  title?: string
  author?: string
  language?: string
  coverPath?: string
  previewPath?: string
}> {
  const opened = await (unzipper as any).Open.file(epubPath)
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

  const getEntry = (name: string) => opened.files.find((f: any) => f.path.replace(/\\/g, '/') === name)
  const container = getEntry('META-INF/container.xml')
  if (!container) throw new Error('container.xml not found')

  const containerXml = parser.parse((await container.buffer()).toString('utf-8'))
  const rootfiles = toArray(containerXml?.container?.rootfiles?.rootfile)
  const opfPath = rootfiles[0]?.['@_full-path']
  if (!opfPath) throw new Error('OPF path not found')

  const opfEntry = getEntry(opfPath)
  if (!opfEntry) throw new Error('OPF not found')

  const opf = parser.parse((await opfEntry.buffer()).toString('utf-8'))
  const metadata = opf?.package?.metadata ?? {}
  const manifest = toArray(opf?.package?.manifest?.item)
  const metaNodes = toArray(metadata?.meta)

  const coverId = metaNodes
    .map((m: any) => (m?.['@_name'] || '').toLowerCase() === 'cover' ? m?.['@_content'] : undefined)
    .find(Boolean) as string | undefined

  let coverHref: string | undefined
  if (coverId) {
    coverHref = manifest.find((item: any) => item?.['@_id'] === coverId)?.['@_href']
  }
  if (!coverHref) {
    coverHref = manifest.find((item: any) => String(item?.['@_properties'] || '').includes('cover-image'))?.['@_href']
  }

  const meta: Record<string, any> = {}
  meta.title = pickText(metadata['dc:title'])
  meta.author = pickText(metadata['dc:creator'])
  meta.language = pickText(metadata['dc:language'])

  if (coverHref) {
    const normalized = normalizeZipPath(opfPath, coverHref)
    const coverEntry = getEntry(normalized)
    if (coverEntry) {
      const buf = await coverEntry.buffer()
      Object.assign(meta, await generateThumbnails(buf, bookId))
    }
  }

  return meta
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

function collectImagesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const result: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...collectImagesRecursive(full))
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      result.push(full)
    }
  }
  return result
}

async function generateThumbnails(input: string | Buffer, bookId: number) {
  const base = sharp(input)
  const coverFs = path.join(paths.thumbnails, `${bookId}.jpg`)
  const previewFs = path.join(paths.previews, `${bookId}.jpg`)
  await base.clone().resize(256, 256, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(coverFs)
  await base
    .clone()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(previewFs)
  return { coverPath: `/thumbnails/${bookId}.jpg`, previewPath: `/previews/${bookId}.jpg` }
}

function normalizeZipPath(opfPath: string, href: string) {
  const base = opfPath.split('/').slice(0, -1).join('/')
  return (base ? `${base}/${href}` : href).replace(/\\/g, '/')
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function pickText(node: any): string | undefined {
  if (!node) return undefined
  if (Array.isArray(node)) return pickText(node[0])
  if (typeof node === 'object') {
    if ('#text' in node) return String(node['#text']).trim()
    const values = Object.values(node)
    if (values.length) return pickText(values[0])
    return undefined
  }
  if (typeof node === 'string') return node.trim()
  return undefined
}

function calculatePercent(page: number, total: number | null) {
  if (!total || total <= 0) return 0
  const pct = (page / total) * 100
  return Math.max(0, Math.min(100, Number(pct.toFixed(2))))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
