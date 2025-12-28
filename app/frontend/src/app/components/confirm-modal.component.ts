import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { I18nService } from '../services/i18n.service'

@Component({
    standalone: true,
    selector: 'app-confirm-modal',
    imports: [CommonModule],
    styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .panel { width: 90%; max-width: 400px; border-radius: 16px; padding: 24px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
  `],
    template: `
  <div class="backdrop" *ngIf="open" (click)="onCancel()">
    <div class="panel transition-all transform scale-100" (click)="$event.stopPropagation()"
         [ngClass]="{'bg-white text-aizome': dayMode, 'bg-slate-800 text-slate-100': !dayMode}">
      <h2 class="text-xl font-bold mb-3">{{ title }}</h2>
      <p class="text-sm opacity-80 mb-6 leading-relaxed">{{ message }}</p>
      <div class="flex gap-3 justify-end">
        <button 
          class="px-4 py-2 rounded-lg font-medium transition-colors border"
          [ngClass]="dayMode ? 'hover:bg-gray-100 border-gray-200' : 'hover:bg-slate-700 border-slate-700'"
          (click)="onCancel()"
        >
          {{ cancelText || i18n.t('common.cancel') }}
        </button>
        <button 
          class="px-5 py-2 rounded-lg font-medium text-white transition-all active:scale-95 shadow-lg"
          [ngClass]="danger ? 'bg-kurenai hover:bg-red-600' : 'bg-matcha hover:bg-green-600'"
          (click)="onConfirm()"
        >
          {{ confirmText || i18n.t('common.confirm') }}
        </button>
      </div>
    </div>
  </div>
  `
})
export class ConfirmModalComponent {
    @Input() open = false
    @Input() dayMode = true
    @Input() title = ''
    @Input() message = ''
    @Input() confirmText = ''
    @Input() cancelText = ''
    @Input() danger = false

    @Output() confirm = new EventEmitter<void>()
    @Output() cancel = new EventEmitter<void>()

    constructor(public i18n: I18nService) { }

    onConfirm() {
        this.confirm.emit()
    }

    onCancel() {
        this.cancel.emit()
    }
}
