import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { z } from 'zod'
import slugify from 'slugify'
import unzipper from 'unzipper'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { XMLParser } from 'fast-xml-parser'
import { db, paths } from '../db'
import { authRequired } from '../middleware/auth'
import { appendAudit } from '../util/audit'
import type { Role } from '../types'

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

router.get('/', authRequired(), async (req, res) => {
  const { query, format, tag, lang, page = 1, limit = 24, sort = 'createdAt.desc' } = QuerySchema.parse(req.query)
  const take = Math.max(1, Math.min(limit, 60))
  const currentPage = Math.max(1, page)

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

  const rows = await q
    .orderBy(orderCol, orderDir)
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
  const book = await db
    .selectFrom('books')
    .selectAll()
    .where('id', '=', id)
    .where('deleted', '=', 0)
    .executeTakeFirst()
  if (!book) return res.status(404).json({ error: 'Not found' })
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
    })
    fs.createReadStream(file, { start, end }).pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=0'
    })
    fs.createReadStream(file).pipe(res)
  }
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

async function extractCbzToPages(zipPath: string, bookId: number) {
  const outDir = path.join(paths.pages, String(bookId))
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })

  await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: outDir })).promise()

  const files = collectImagesRecursive(outDir)
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  files.sort((a, b) => collator.compare(path.basename(a), path.basename(b)))

  let index = 1
  let firstProcessedPath: string | null = null
  for (const src of files) {
    const dst = path.join(outDir, `${index}.jpg`)
    await sharp(src).jpeg({ quality: 78, progressive: true }).toFile(dst)
    if (!firstProcessedPath) firstProcessedPath = dst
    if (src !== dst && fs.existsSync(src)) fs.unlinkSync(src)
    index++
  }

  const updates: Record<string, any> = { pageCount: Math.max(0, index - 1) }
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
    console.warn('pdftoppm not available, skipping PDF preview generation', err)
  }

  return updates
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
