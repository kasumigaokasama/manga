import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app'
import { ensureStorage, migrateAndSeed } from '../../src/db'
import AdmZip from 'adm-zip'
import sharp from 'sharp'

let app: ReturnType<typeof createApp>

beforeAll(async () => {
  ensureStorage();
  await migrateAndSeed();
  app = createApp();
})

function buildMinimalEpub(title: string, creator: string, language: string) {
  const zip = new AdmZip()
  const container = `<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>`
  zip.addFile('META-INF/container.xml', Buffer.from(container, 'utf-8'))
  const opf = `<?xml version="1.0" encoding="UTF-8"?>\n<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    <dc:title>${title}</dc:title>\n    <dc:creator>${creator}</dc:creator>\n    <dc:language>${language}</dc:language>\n  </metadata>\n  <manifest>\n    <item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>\n  </manifest>\n  <spine/>\n</package>`
  zip.addFile('OEBPS/content.opf', Buffer.from(opf, 'utf-8'))
  return zip
}

describe('EPUB upload', () => {
  it('extracts cover and metadata', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'ChangeThis123!' })
    const token = login.body.accessToken
    const img = await sharp({ create: { width: 100, height: 150, channels: 3, background: { r: 240, g: 160, b: 200 } } }).jpeg().toBuffer()
    const zip = buildMinimalEpub('EPUB Title', 'Author X', 'ja')
    zip.addFile('OEBPS/cover.jpg', img)
    const epubBuf = zip.toBuffer()

    const res = await request(app)
      .post('/api/books/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Given Title')
      .attach('file', epubBuf, { filename: 't.epub', contentType: 'application/epub+zip' })
    expect(res.status).toBe(201)
    const id = res.body.id

    const bookRes = await request(app).get(`/api/books/${id}`).set('Authorization', `Bearer ${token}`)
    expect(bookRes.status).toBe(200)
    // Title remains the given upload title, but language should be taken from EPUB
    expect(bookRes.body.book.title).toBe('Given Title')
    expect(bookRes.body.book.language).toBe('ja')
    expect(bookRes.body.book.coverPath).toMatch(/\/thumbnails\//)
  })
})

