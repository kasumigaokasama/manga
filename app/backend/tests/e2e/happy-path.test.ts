import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app'
import { ensureStorage, migrateAndSeed } from '../../src/db'
import AdmZip from 'adm-zip'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

let app: ReturnType<typeof createApp>

beforeAll(async () => {
  ensureStorage();
  await migrateAndSeed();
  app = createApp();
})

describe('E2E happy path', () => {
  it('health works', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('login and list books', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'ChangeThis123!' })
    expect(login.status).toBe(200)
    expect(login.body.accessToken).toBeTruthy()
    const token = login.body.accessToken

    const list = await request(app).get('/api/books').set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.items)).toBe(true)
    expect(list.body.pagination).toMatchObject({ page: 1 })
  })

  it('upload CBZ → cover + page accessible', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'ChangeThis123!' })
    const token = login.body.accessToken

    // Build a tiny CBZ buffer with 2 images
    const img1 = await sharp({ create: { width: 50, height: 80, channels: 3, background: { r: 255, g: 200, b: 220 } } }).jpeg().toBuffer()
    const img2 = await sharp({ create: { width: 50, height: 80, channels: 3, background: { r: 200, g: 220, b: 255 } } }).jpeg().toBuffer()
    const zip = new AdmZip()
    zip.addFile('001.jpg', img1)
    zip.addFile('002.jpg', img2)
    const cbzBuf = zip.toBuffer()

    const res = await request(app)
      .post('/api/books/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Test CBZ Upload')
      .attach('file', cbzBuf, { filename: 'test.cbz', contentType: 'application/zip' })
    expect(res.status).toBe(201)
    const id = res.body.id
    expect(id).toBeTruthy()

    // Page 1 should be accessible
    const pageRes = await request(app).get(`/api/books/${id}/pages/1`).set('Authorization', `Bearer ${token}`)
    expect(pageRes.status).toBe(200)
    expect(pageRes.headers['content-type']).toMatch(/image\/jpeg/)

    // Book metadata should show cover path and pageCount
    const bookRes = await request(app).get(`/api/books/${id}`).set('Authorization', `Bearer ${token}`)
    expect(bookRes.status).toBe(200)
    expect(bookRes.body.book.coverPath).toMatch(/\/thumbnails\//)
    expect(bookRes.body.book.previewPath).toMatch(/\/previews\//)
    expect(bookRes.body.book.pageCount).toBeGreaterThanOrEqual(2)
  })

  it('upload PDF → range stream works', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'ChangeThis123!' })
    const token = login.body.accessToken

    // Generate minimal PDF
    const pdfDoc = await PDFDocument.create()
    pdfDoc.addPage([200, 200])
    const pdfBytes = await pdfDoc.save()

    const res = await request(app)
      .post('/api/books/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Test PDF Upload')
      .attach('file', Buffer.from(pdfBytes), { filename: 'test.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(201)
    const id = res.body.id

    // HEAD should expose content-length/type and accept-ranges
    const headRes = await request(app).head(`/api/books/${id}/stream`).set('Authorization', `Bearer ${token}`)
    expect(headRes.status).toBe(200)
    expect(headRes.headers['accept-ranges']).toBe('bytes')
    expect(headRes.headers['content-type']).toBe('application/pdf')
    expect(Number(headRes.headers['content-length'] || '0')).toBeGreaterThan(0)

    const rangeRes = await request(app).get(`/api/books/${id}/stream`).set('Authorization', `Bearer ${token}`).set('Range', 'bytes=0-99')
    expect(rangeRes.status).toBe(206)
    expect(rangeRes.headers['content-range']).toMatch(/^bytes 0-99\//)
    expect(rangeRes.headers['content-type']).toBe('application/pdf')
    expect(Number(rangeRes.headers['content-length'])).toBe(100)
  })
})
