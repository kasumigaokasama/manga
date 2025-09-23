import { Injectable, computed, signal } from '@angular/core'

export type User = { sub: number, email: string, role: 'admin'|'editor'|'reader' }
export type Book = { id: number, title: string, author?: string, format: string, coverPath?: string }
export type AdminUser = { id: number, email: string, role: 'admin'|'editor'|'reader', createdAt: string }

@Injectable({ providedIn: 'root' })
export class ApiService {
  base = localStorage.getItem('apiBase') || 'http://localhost:3000'
  token = signal<string | null>(localStorage.getItem('token'))
  role = computed<'admin'|'editor'|'reader'|'none'>(() => {
    const t = this.token(); if (!t) return 'none'
    try {
      const payload = JSON.parse(atob(t.split('.')[1]))
      return (payload.role ?? 'none') as any
    } catch { return 'none' }
  })
  email = computed<string | null>(() => {
    const t = this.token(); if (!t) return null
    try { return JSON.parse(atob(t.split('.')[1]))?.email ?? null } catch { return null }
  })

  private headers() {
    const h: any = { 'Content-Type': 'application/json' }
    const t = this.token()
    if (t) h['Authorization'] = `Bearer ${t}`
    return h
  }

  async login(email: string, password: string) {
    const r = await fetch(`${this.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (!r.ok) throw new Error('Login failed')
    const data = await r.json()
    localStorage.setItem('token', data.accessToken)
    this.token.set(data.accessToken)
  }

  logout() {
    localStorage.removeItem('token')
    this.token.set(null)
  }

  async me(): Promise<User | null> {
    const t = this.token(); if (!t) return null
    const r = await fetch(`${this.base}/api/auth/me`, { headers: this.headers() })
    if (!r.ok) return null
    const data = await r.json()
    return data.user
  }

  async listBooks(params?: { query?: string; format?: string; tag?: string }): Promise<Book[]> {
    const q = new URLSearchParams()
    if (params?.query) q.set('query', params.query)
    if (params?.format) q.set('format', params.format)
    if (params?.tag) q.set('tag', params.tag)
    const url = `${this.base}/api/books${q.toString() ? '?' + q.toString() : ''}`
    const r = await fetch(url)
    const data = await r.json()
    return data.items
  }

  async getBook(id: number): Promise<Book> {
    const r = await fetch(`${this.base}/api/books/${id}`)
    if (!r.ok) throw new Error('Not found')
    const data = await r.json()
    return data.book
  }

  async uploadBook(form: FormData) {
    const r = await fetch(`${this.base}/api/books/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${this.token()}` }, body: form })
    if (!r.ok) throw new Error('Upload failed')
    return r.json()
  }

  async getTags(): Promise<string[]> {
    const r = await fetch(`${this.base}/api/tags`)
    const data = await r.json()
    return data.tags?.map((t: any) => t.name) ?? []
  }

  async deleteBook(id: number) {
    const r = await fetch(`${this.base}/api/books/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token()}` } })
    if (!r.ok) throw new Error('Delete failed')
  }

  async adminListUsers(): Promise<AdminUser[]> {
    const r = await fetch(`${this.base}/api/users`, { headers: { 'Authorization': `Bearer ${this.token()}` } })
    if (!r.ok) throw new Error('Not authorized')
    return (await r.json()).users
  }

  async adminCreateUser(email: string, password: string, role: 'admin'|'editor'|'reader') {
    const r = await fetch(`${this.base}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token()}` }, body: JSON.stringify({ email, password, role }) })
    if (!r.ok) throw new Error('Create failed')
    return (await r.json()).user
  }

  async adminSetPassword(id: number, password: string) {
    const r = await fetch(`${this.base}/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token()}` }, body: JSON.stringify({ password }) })
    if (!r.ok) throw new Error('Update failed')
  }

  async adminListAudit(limit = 200): Promise<any[]> {
    const r = await fetch(`${this.base}/api/audit?limit=${limit}`, { headers: { 'Authorization': `Bearer ${this.token()}` } })
    if (!r.ok) throw new Error('Not authorized')
    return (await r.json()).events
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const r = await fetch(`${this.base}/api/account/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token()}` }, body: JSON.stringify({ currentPassword, newPassword }) })
    if (!r.ok) throw new Error('Password change failed')
  }
}
