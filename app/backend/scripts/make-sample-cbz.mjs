import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import sharp from 'sharp'

const out = path.resolve(process.cwd(), '../../sample.cbz')

async function main() {
  const img1 = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 249, g: 213, b: 229 } } })
    .jpeg({ quality: 80 }).toBuffer()
  const img2 = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 200, g: 220, b: 255 } } })
    .jpeg({ quality: 80 }).toBuffer()
  const zip = new AdmZip()
  zip.addFile('001.jpg', img1)
  zip.addFile('002.jpg', img2)
  fs.writeFileSync(out, zip.toBuffer())
  console.log('Wrote', out)
}

main().catch((e) => { console.error(e); process.exit(1) })

