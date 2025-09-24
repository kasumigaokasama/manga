import fs from 'node:fs'
import path from 'node:path'

const auditFile = path.resolve('storage/db/audit.log')

export function appendAudit(event: string, data: Record<string, any>) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + '\n'
    fs.mkdirSync(path.dirname(auditFile), { recursive: true })
    fs.appendFileSync(auditFile, line)
  } catch {
    // best effort only
  }
}
