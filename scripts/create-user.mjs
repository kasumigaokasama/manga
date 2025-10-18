import fs from 'node:fs'

const base = process.env.BASE || 'http://localhost:3000'
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThis123!'
const newEmail = process.env.NEW_EMAIL || 'galiferous@example.com'
const newPassword = process.env.NEW_PASSWORD || 'start123'
const newRole = process.env.NEW_ROLE || 'reader'

async function main() {
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: adminPassword })
  })
  if (!loginRes.ok) throw new Error('Admin login failed')
  const { accessToken } = await loginRes.json()
  const r = await fetch(`${base}/api/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole })
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`Create failed: ${r.status} ${t}`)
  }
  console.log('USER_CREATED', newEmail)
}

main().catch((e) => { console.error(e); process.exit(1) })
