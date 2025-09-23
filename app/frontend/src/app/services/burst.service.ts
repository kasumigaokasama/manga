import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class BurstService {
  private listeners: Array<(count: number, at?: { x: number; y: number }) => void> = []
  on(listener: (count: number, at?: { x: number; y: number }) => void) { this.listeners.push(listener) }
  off(listener: (c: number, a?: { x: number; y: number }) => void) { this.listeners = this.listeners.filter(l => l !== listener) }
  trigger(count = 18, at?: { x: number; y: number }) { for (const l of this.listeners) l(count, at) }
}

