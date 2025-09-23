import { Injectable, signal } from '@angular/core'

const dict = {
  de: { library: 'Bibliothek', upload: 'Upload', settings: 'Einstellungen' },
  en: { library: 'Library', upload: 'Upload', settings: 'Settings' },
  ja: { library: 'ライブラリ', upload: 'アップロード', settings: '設定' }
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  lang = signal<'de'|'en'|'ja'>((localStorage.getItem('lang') as any) || 'de')
  set(v: 'de'|'en'|'ja') { this.lang.set(v); localStorage.setItem('lang', v) }
  t(key: keyof typeof dict['de']) { return (dict as any)[this.lang()][key] || key }
}

