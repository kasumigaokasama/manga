import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ToastService } from '../services/toast.service'

@Component({
  standalone: true,
  selector: 'app-toast-container',
  imports: [CommonModule],
  styles: [`
    :host { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 70; }
    .toast { min-width: 240px; margin-top: 8px; border-radius: 8px; padding: 10px 12px; box-shadow: 0 10px 24px rgba(0,0,0,.18); animation: fadeIn .2s ease; }
    .success { background: #10b981; color: white; }
    .error { background: #ef4444; color: white; }
    .info { background: #3b82f6; color: white; }
    @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, 8px) } to { opacity: 1; transform: translate(-50%, 0) } }
  `],
  template: `
    <div *ngFor="let t of toast.toasts()" class="toast" [ngClass]="t.type" role="status" aria-live="polite">{{ t.text }}</div>
  `
})
export class ToastContainerComponent {
  constructor(public toast: ToastService) {}
}
