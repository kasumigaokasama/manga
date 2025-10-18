import { Injectable, computed, signal } from '@angular/core'
import { SettingsService } from './settings.service'

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
  base = (function(){
    const fromStorage = localStorage.getItem('apiBase');
    if (fromStorage) return fromStorage;
    try {
      if (typeof location !== 'undefined') {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          // If frontend runs on :4300 (Windows dev), point API to :3001
          if (location.port === '4300') return 'http://localhost:3001';
          return 'http://localhost:3000';
        }
      }
    } catch {}
    return '';
  })()
  token = signal<string | null>(localStorage.getItem('token'))
  user = signal<User | null>(null)
  authMode = signal<'unknown' | 'header' | 'cookie'>('unknown')

  role = computed<'admin' | 'editor' | 'reader' | 'none'>(() => {
    const u = this.user()
    if (u) return u.role
    const t = this.token()
    if (!t) return 'none'
    try { return (JSON.parse(atob(t.split('.')[1]))?.role ?? 'none') as any } catch { return 'none' }
  })

  email = computed<string | null>(() => this.user()?.email ?? (() => {
    const t = this.token(); if (!t) return null; try { return JSON.parse(atob(t.split('.')[1]))?.email ?? null } catch { return null }
  })())

  expired = computed<boolean>(() => {
    const t = this.token()
    if (!t) return true
    try {
      const payload = JSON.parse(atob(t.split('.')[1]))
      const exp = typeof payload.exp === 'number' ? payload.exp : 0
      const now = Math.floor(Date.now() / 1000)
      return exp !== 0 && exp <= now
    } catch {
      return true
    }
  })

  isTokenValid(): boolean {
    return !!this.token() && !this.expired()
  }

  isAuthenticated = computed<boolean>(() => !!this.user())

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
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!r.ok) throw new Error('Login failed')
    const data = await r.json().catch(() => ({}))
    if (data?.accessToken) {
      localStorage.setItem('token', data.accessToken)
      this.token.set(data.accessToken)
      this.authMode.set('header')
      await this.refreshMe()
    } else {
      // Cookie-only mode: rely on HttpOnly cookie
      this.token.set(null)
      this.authMode.set('cookie')
      await this.refreshMe()
    }
  }

  logout() {
    // Clear server cookie (if present), then local token
    fetch(`${this.base}/api/auth/logout`, { method: 'POST' }).catch(() => {})
    localStorage.removeItem('token')
    this.token.set(null)
    this.user.set(null)
    this.authMode.set('unknown')
  }

  async me(): Promise<User | null> {
    const r = await fetch(`${this.base}/api/auth/me`, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) return null
    const data = await r.json()
    return data.user
  }

  async refreshMe() {
    try {
      const u = await this.me()
      this.user.set(u)
      if (u && this.authMode() === 'unknown') this.authMode.set(this.token() ? 'header' : 'cookie')
    } catch { this.user.set(null) }
  }

  private idleTimer?: any
  constructor(private settings: SettingsService) {
    // kick off initial session fetch (cookie or header)
    this.refreshMe()
    // Refresh on focus/visibility
    try {
      window.addEventListener('focus', () => this.refreshMe())
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.refreshMe() })
      window.addEventListener('storage', (ev) => {
        if (ev.key === 'token') {
          this.token.set(localStorage.getItem('token'))
          this.refreshMe()
        }
      })
    } catch {}
    // Periodic refresh (5 minutes)
    setInterval(() => this.refreshMe(), 5 * 60 * 1000)
    // Idle timeout tracking
    try {
      const reset = () => this.resetIdleTimer()
      window.addEventListener('pointerdown', reset, { passive: true } as any)
      window.addEventListener('keydown', reset)
      window.addEventListener('touchstart', reset, { passive: true } as any)
      document.addEventListener('visibilitychange', reset)
    } catch {}
  }

  private resetIdleTimer() {
    try { clearTimeout(this.idleTimer) } catch {}
    if (!this.user() || this.settings.keepSignedIn()) return
    const ms = Math.max(5, this.settings.idleMinutes()) * 60 * 1000
    this.idleTimer = setTimeout(() => { try { this.logout() } catch {} }, ms)
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
    const r = await fetch(url, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) throw new Error('Failed to load books')
    return r.json()
  }

  async getBook(id: number): Promise<BookDetailResponse> {
    const r = await fetch(`${this.base}/api/books/${id}`, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) throw new Error('Not found')
    return r.json()
  }

  async getTags(): Promise<string[]> {
    const r = await fetch(`${this.base}/api/tags`, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) throw new Error('Failed to load tags')
    const data = await r.json()
    return data.tags?.map((t: any) => t.name) ?? []
  }

  async getLanguages(): Promise<string[]> {
    const r = await fetch(`${this.base}/api/books/languages`, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) throw new Error('Failed to load languages')
    const data = await r.json()
    return data.languages ?? []
  }

  async uploadBook(form: FormData) {
    const r = await fetch(`${this.base}/api/books/upload`, {
      method: 'POST',
      headers: this.authHeaders(),
      credentials: 'include',
      body: form
    })
    if (!r.ok) throw new Error('Upload failed')
    return r.json()
  }

  async deleteBook(id: number) {
    const r = await fetch(`${this.base}/api/books/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
      credentials: 'include'
    })
    if (!r.ok) throw new Error('Delete failed')
  }

  async getProgress(id: number): Promise<ProgressResponse | null> {
    const r = await fetch(`${this.base}/api/books/${id}/progress`, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) return null
    const data = await r.json()
    return data.progress ? { page: data.progress.page ?? 0, percent: data.progress.percent ?? 0 } : null
  }

  async setProgress(id: number, page: number, percent: number) {
    await fetch(`${this.base}/api/books/${id}/progress`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({ page, percent })
    })
  }

  async adminListUsers(): Promise<AdminUser[]> {
    const r = await fetch(`${this.base}/api/users`, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) throw new Error('Not authorized')
    return (await r.json()).users
  }

  async adminCreateUser(email: string, password: string, role: 'admin' | 'editor' | 'reader') {
    const r = await fetch(`${this.base}/api/users`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({ email, password, role })
    })
    if (!r.ok) throw new Error('Create failed')
    return (await r.json()).user
  }

  async adminSetPassword(id: number, password: string) {
    const r = await fetch(`${this.base}/api/users/${id}`, {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({ password })
    })
    if (!r.ok) throw new Error('Update failed')
  }

  async adminListAudit(limit = 200): Promise<any[]> {
    const r = await fetch(`${this.base}/api/audit?limit=${limit}`, { headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) throw new Error('Not authorized')
    return (await r.json()).events
  }

  async adminHealLibrary(): Promise<{ ok: boolean; fixed: number }> {
    const r = await fetch(`${this.base}/api/books/heal`, { method: 'POST', headers: this.authHeaders(), credentials: 'include' })
    if (!r.ok) throw new Error('Heal failed')
    return r.json()
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const r = await fetch(`${this.base}/api/account/password`, {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword })
    })
    if (!r.ok) throw new Error('Password change failed')
  }
}

