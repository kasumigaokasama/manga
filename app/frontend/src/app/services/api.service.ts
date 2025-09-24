import { Injectable, computed, signal } from '@angular/core'

export type User = { sub: number; email: string; role: 'admin' | 'editor' | 'reader' }
export type Book = {
  id: number
  title: string
  author?: string | null
  format: 'pdf' | 'epub' | 'cbz' | 'images'
  coverPath?: string | null
  previewPath?: string | null
  language?: string | null
  pageCount?: number | null
  createdAt?: string
}
export type AdminUser = { id: number; email: string; role: 'admin' | 'editor' | 'reader'; createdAt: string }
export type BookListResponse = { items: Book[]; pagination: { page: number; limit: number; hasMore: boolean } }
export type BookDetailResponse = { book: Book; tags: string[] }
export type ProgressResponse = { page: number; percent: number }

@Injectable({ providedIn: 'root' })
export class ApiService {
  base = localStorage.getItem('apiBase') || 'http://localhost:3000'
  token = signal<string | null>(localStorage.getItem('token'))

  role = computed<'admin' | 'editor' | 'reader' | 'none'>(() => {
    const t = this.token()
    if (!t) return 'none'
    try {
      const payload = JSON.parse(atob(t.split('.')[1]))
      return (payload.role ?? 'none') as any
    } catch {
      return 'none'
    }
  })

  email = computed<string | null>(() => {
    const t = this.token()
    if (!t) return null
    try {
      return JSON.parse(atob(t.split('.')[1]))?.email ?? null
    } catch {
      return null
    }
  })

  private authHeaders(extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extra }
    const t = this.token()
    if (t) headers['Authorization'] = `Bearer ${t}`
    return headers
  }

  private jsonHeaders() {
    return this.authHeaders({ 'Content-Type': 'application/json' })
  }

  async login(email: string, password: string) {
    const payload = { email: email.trim().toLowerCase(), password }
    const r = await fetch(`${this.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
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
    if (!this.token()) return null
    const r = await fetch(`${this.base}/api/auth/me`, { headers: this.authHeaders() })
    if (!r.ok) return null
    const data = await r.json()
    return data.user
  }

  async listBooks(params?: {
    query?: string
    format?: string
    tag?: string
    lang?: string
    sort?: string
    page?: number
    limit?: number
  }): Promise<BookListResponse> {
    const q = new URLSearchParams()
    if (params?.query) q.set('query', params.query)
    if (params?.format) q.set('format', params.format)
    if (params?.tag) q.set('tag', params.tag)
    if (params?.lang) q.set('lang', params.lang)
    if (params?.sort) q.set('sort', params.sort)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    const url = `${this.base}/api/books${q.toString() ? `?${q.toString()}` : ''}`
    const r = await fetch(url, { headers: this.authHeaders() })
    if (!r.ok) throw new Error('Failed to load books')
    return r.json()
  }

  async getBook(id: number): Promise<BookDetailResponse> {
    const r = await fetch(`${this.base}/api/books/${id}`, { headers: this.authHeaders() })
    if (!r.ok) throw new Error('Not found')
    return r.json()
  }

  async getTags(): Promise<string[]> {
    const r = await fetch(`${this.base}/api/tags`, { headers: this.authHeaders() })
    if (!r.ok) throw new Error('Failed to load tags')
    const data = await r.json()
    return data.tags?.map((t: any) => t.name) ?? []
  }

  async getLanguages(): Promise<string[]> {
    const r = await fetch(`${this.base}/api/books/languages`, { headers: this.authHeaders() })
    if (!r.ok) throw new Error('Failed to load languages')
    const data = await r.json()
    return data.languages ?? []
  }

  async uploadBook(form: FormData) {
    const r = await fetch(`${this.base}/api/books/upload`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form
    })
    if (!r.ok) throw new Error('Upload failed')
    return r.json()
  }

  async deleteBook(id: number) {
    const r = await fetch(`${this.base}/api/books/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders()
    })
    if (!r.ok) throw new Error('Delete failed')
  }

  async getProgress(id: number): Promise<ProgressResponse | null> {
    const r = await fetch(`${this.base}/api/books/${id}/progress`, { headers: this.authHeaders() })
    if (!r.ok) return null
    const data = await r.json()
    return data.progress ? { page: data.progress.page ?? 0, percent: data.progress.percent ?? 0 } : null
  }

  async setProgress(id: number, page: number, percent: number) {
    await fetch(`${this.base}/api/books/${id}/progress`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ page, percent })
    })
  }

  async adminListUsers(): Promise<AdminUser[]> {
    const r = await fetch(`${this.base}/api/users`, { headers: this.authHeaders() })
    if (!r.ok) throw new Error('Not authorized')
    return (await r.json()).users
  }

  async adminCreateUser(email: string, password: string, role: 'admin' | 'editor' | 'reader') {
    const r = await fetch(`${this.base}/api/users`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ email, password, role })
    })
    if (!r.ok) throw new Error('Create failed')
    return (await r.json()).user
  }

  async adminSetPassword(id: number, password: string) {
    const r = await fetch(`${this.base}/api/users/${id}`, {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ password })
    })
    if (!r.ok) throw new Error('Update failed')
  }

  async adminListAudit(limit = 200): Promise<any[]> {
    const r = await fetch(`${this.base}/api/audit?limit=${limit}`, { headers: this.authHeaders() })
    if (!r.ok) throw new Error('Not authorized')
    return (await r.json()).events
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const r = await fetch(`${this.base}/api/account/password`, {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    })
    if (!r.ok) throw new Error('Password change failed')
  }
}
