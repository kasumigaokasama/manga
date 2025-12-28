import { Injectable, signal } from '@angular/core'
import { translations } from '../i18n/translations'

export type Lang = keyof typeof translations;

@Injectable({ providedIn: 'root' })
export class I18nService {
  lang = signal<Lang>((localStorage.getItem('lang') as Lang) || 'en')

  set(v: Lang) {
    this.lang.set(v)
    localStorage.setItem('lang', v)
  }

  t(key: string, params: Record<string, any> = {}): string {
    const keys = key.split('.')
    let current: any = translations[this.lang()]

    for (const k of keys) {
      if (!current || current[k] === undefined) return key
      current = current[k]
    }

    let result = current
    const count = Number(params['count'])
    if (result.includes('|') && !isNaN(count)) {
      const parts = result.split('|')
      result = (count === 1 ? parts[0] : parts[1] || parts[0]).trim()
    }

    for (const [pk, pv] of Object.entries(params)) {
      result = result.replace(new RegExp(`{{${pk}}}`, 'g'), String(pv))
    }
    return result
  }
}

