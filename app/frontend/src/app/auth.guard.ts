import { inject } from '@angular/core'
import { CanMatchFn, Router } from '@angular/router'
import { ApiService } from './services/api.service'

export const authGuard: CanMatchFn = () => {
  const api = inject(ApiService)
  const router = inject(Router)
  if (!api.token()) { router.navigateByUrl('/login'); return false }
  return true
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

