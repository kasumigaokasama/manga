import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const UploadSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  language: z.string().optional()
})

describe('Upload validation', () => {
  it('rejects empty title', () => {
    const r = UploadSchema.safeParse({ title: '' })
    expect(r.success).toBe(false)
  })
  it('accepts minimal payload', () => {
    const r = UploadSchema.safeParse({ title: 'My Book' })
    expect(r.success).toBe(true)
  })
})

