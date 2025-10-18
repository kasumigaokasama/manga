import { Injectable, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class SettingsService {
  // Reader defaults
  readerRtl = signal<boolean>(localStorage.getItem('readerRtl') !== 'false')
  readerSpread = signal<boolean>(localStorage.getItem('readerSpread') === 'true')
  // UI: show offline badge on covers
  showOfflineBadge = signal<boolean>((localStorage.getItem('offlineBadge') ?? '1') === '1')
  // Reader prefetch behavior
  aggressivePrefetch = signal<boolean>((localStorage.getItem('aggrPrefetch') ?? '0') === '1')
  // Mobile enforcement (phone-friendly defaults like spread off)
  forceMobile = signal<boolean>((localStorage.getItem('forceMobile') ?? '0') === '1')
  // Toolbar: icons-only mode
  toolbarIconsOnly = signal<boolean>((localStorage.getItem('toolbarIconsOnly') ?? '0') === '1')
  // Auth: keep signed in and idle timeout (minutes)
  keepSignedIn = signal<boolean>((localStorage.getItem('keepSignedIn') ?? '1') === '1')
  idleMinutes = signal<number>(Number(localStorage.getItem('idleMinutes') || '20') || 20)

  setReaderRtl(v: boolean) { this.readerRtl.set(v); localStorage.setItem('readerRtl', String(v)) }
  setReaderSpread(v: boolean) { this.readerSpread.set(v); localStorage.setItem('readerSpread', String(v)) }
  setShowOfflineBadge(v: boolean) { this.showOfflineBadge.set(v); localStorage.setItem('offlineBadge', v ? '1' : '0') }
  setAggressivePrefetch(v: boolean) { this.aggressivePrefetch.set(v); localStorage.setItem('aggrPrefetch', v ? '1' : '0') }
  setForceMobile(v: boolean) { this.forceMobile.set(v); localStorage.setItem('forceMobile', v ? '1' : '0') }
  setToolbarIconsOnly(v: boolean) { this.toolbarIconsOnly.set(v); localStorage.setItem('toolbarIconsOnly', v ? '1' : '0') }
  setKeepSignedIn(v: boolean) { this.keepSignedIn.set(v); localStorage.setItem('keepSignedIn', v ? '1' : '0') }
  setIdleMinutes(v: number) {
    const n = Math.max(5, Math.min(240, Math.floor(v)))
    this.idleMinutes.set(n)
    localStorage.setItem('idleMinutes', String(n))
  }
}
