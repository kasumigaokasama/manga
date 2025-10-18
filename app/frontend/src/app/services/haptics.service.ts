import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class HapticsService {
  private supported = typeof navigator !== 'undefined' && typeof (navigator as any).vibrate === 'function'
  private enabledKey = 'hapticsEnabled'
  enabled = this.loadEnabled()

  tap() {
    this.vibrate(10)
  }

  heavy() {
    this.vibrate([20, 40, 20])
  }

  success() {
    this.vibrate([15, 30, 15])
  }

  error() {
    this.vibrate([30, 50, 30])
  }

  isEnabled() { return !!this.enabled }
  setEnabled(v: boolean) {
    this.enabled = !!v
    try { localStorage.setItem(this.enabledKey, String(this.enabled)) } catch {}
  }

  private vibrate(pattern: number | number[]) {
    try {
      if (this.supported && this.enabled) (navigator as any).vibrate(pattern)
    } catch { /* ignore */ }
  }

  private loadEnabled(): boolean {
    try {
      const raw = localStorage.getItem(this.enabledKey)
      if (raw === null) return true
      return raw === 'true'
    } catch { return true }
  }
}
