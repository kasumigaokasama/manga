import { inject } from '@angular/core'
import { CanMatchFn, Router, UrlSegment } from '@angular/router'
import { ApiService } from './services/api.service'

export const authGuard: CanMatchFn = async (_route, segments: UrlSegment[]) => {
  const api = inject(ApiService)
  const router = inject(Router)
  // If we already have a user, allow
  if (api.isAuthenticated()) return true
  // If we have a header token, allow optimistically
  if (api.isTokenValid()) return true
  // Try to refresh session (cookie or header)
  try { await api.refreshMe() } catch {}
  if (api.isAuthenticated()) return true
  const attempted = '/' + segments.map(s => s.path).join('/')
  router.navigateByUrl(`/login?returnUrl=${encodeURIComponent(attempted || '/library')}`)
  return false
}

export function roleGuard(roles: Array<'admin'|'editor'|'reader'>): CanMatchFn {
  return () => {
    const api = inject(ApiService)
    const router = inject(Router)
    const r = api.role()
    if (r === 'none' || !roles.includes(r as any)) { router.navigateByUrl('/library'); return false }
    return true
  }
}
