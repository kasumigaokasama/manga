import { Injectable, signal } from '@angular/core'

export type Toast = { id: number; text: string; type: 'success'|'error'|'info' };

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([])
  private nextId = 1

  show(text: string, type: 'success'|'error'|'info' = 'info', ms = 2500) {
    const id = this.nextId++
    this.toasts.update(arr => [...arr, { id, text, type }])
    setTimeout(() => this.dismiss(id), ms)
  }

  dismiss(id: number) { this.toasts.update(arr => arr.filter(t => t.id !== id)) }
  clear() { this.toasts.set([]) }
}

