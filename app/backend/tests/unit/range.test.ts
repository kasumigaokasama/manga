import { describe, it, expect } from 'vitest'

function parseRange(range: string, size: number) {
  const [s, e] = range.replace('bytes=', '').split('-')
  const start = parseInt(s, 10)
  const end = e ? parseInt(e, 10) : size - 1
  return { start, end, length: end - start + 1 }
}

describe('Range support', () => {
  it('parses typical range header', () => {
    const r = parseRange('bytes=0-1023', 5000)
    expect(r.start).toBe(0)
    expect(r.end).toBe(1023)
    expect(r.length).toBe(1024)
  })
})

