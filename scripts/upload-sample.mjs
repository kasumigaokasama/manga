import fs from 'node:fs'

const base = process.env.BASE || 'http://localhost:3000'
const email = process.env.EMAIL || 'admin@example.com'
const password = process.env.PASSWORD || 'ChangeThis123!'
let sample = process.env.SAMPLE || new URL('../sample.pdf', import.meta.url).pathname
// Normalize Windows paths like '/C:/manga/sample.pdf' → 'C:\manga\sample.pdf'
if (/^\/[A-Za-z]:\//.test(sample)) sample = sample.slice(1)

async function main() {
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!loginRes.ok) throw new Error('Login failed')
  const { accessToken } = await loginRes.json()
  const buf = fs.readFileSync(sample)
  const fd = new FormData()
  fd.append('title', 'Sample PDF')
  fd.append('file', new Blob([buf], { type: 'application/pdf' }), 'sample.pdf')
  const up = await fetch(`${base}/api/books/upload`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: fd })
  if (!up.ok) throw new Error(`Upload failed: ${up.status}`)
  const data = await up.json()
  console.log('UPLOADED', data)
  const id = data.id
  const head = await fetch(`${base}/api/books/${id}/stream`, { method: 'HEAD', headers: { Authorization: `Bearer ${accessToken}` } })
  console.log('HEAD', head.status, Object.fromEntries(head.headers.entries()))
  const range = await fetch(`${base}/api/books/${id}/stream`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, Range: 'bytes=0-99' } })
  console.log('RANGE', range.status, 'len', (await range.arrayBuffer()).byteLength)
}

main().catch((e) => { console.error(e); process.exit(1) })
