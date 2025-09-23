import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx?: AudioContext
  private _enabled = localStorage.getItem('soundEnabled') === '1'
  private _volume = Number(localStorage.getItem('soundVolume') || '0') // default muted

  get enabled() { return this._enabled }
  get volume() { return this._volume }
  setEnabled(v: boolean) { this._enabled = v; localStorage.setItem('soundEnabled', v ? '1' : '0') }
  setVolume(v: number) { this._volume = Math.max(0, Math.min(1, v)); localStorage.setItem('soundVolume', String(this._volume)) }

  private ensureCtx() { if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)() }

  playBurst() {
    if (!this._enabled || this._volume <= 0) return
    this.ensureCtx()
    const now = this.ctx!.currentTime
    const o = this.ctx!.createOscillator()
    const g = this.ctx!.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(660, now)
    o.frequency.exponentialRampToValueAtTime(990, now + 0.12)
    g.gain.value = this._volume * 0.06
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    o.connect(g).connect(this.ctx!.destination)
    o.start(now)
    o.stop(now + 0.2)
  }
}

