import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'

describe('JWT', () => {
  it('signs and verifies token', () => {
    const secret = 'test-secret'
    const token = jwt.sign({ sub: 1, email: 'a@b.c', role: 'admin' }, secret, { expiresIn: '1h' })
    const payload = jwt.verify(token, secret) as any
    expect(payload.sub).toBe(1)
    expect(payload.role).toBe('admin')
  })
})

