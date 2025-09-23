import { Injectable, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class SettingsService {
  // Reader defaults
  readerRtl = signal<boolean>(localStorage.getItem('readerRtl') !== 'false')
  readerSpread = signal<boolean>(localStorage.getItem('readerSpread') === 'true')

  setReaderRtl(v: boolean) { this.readerRtl.set(v); localStorage.setItem('readerRtl', String(v)) }
  setReaderSpread(v: boolean) { this.readerSpread.set(v); localStorage.setItem('readerSpread', String(v)) }
}

