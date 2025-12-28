import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { I18nService } from '../services/i18n.service'

@Component({
  standalone: true,
  selector: 'app-help-modal',
  imports: [CommonModule],
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
    .panel { max-width: 720px; width: 90%; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.2) }
  `],
  template: `
  <div class="backdrop" *ngIf="open" (click)="close.emit()">
    <div class="panel" (click)="$event.stopPropagation()"
         [ngClass]="{'bg-white text-aizome': dayMode, 'bg-slate-800 text-slate-100': !dayMode}">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-bold">{{ i18n.t('pages.help.title') }}</h2>
        <button class="border px-2 py-1 rounded" (click)="close.emit()">{{ i18n.t('common.close') }}</button>
      </div>
      <div class="text-sm space-y-2">
        <div>
          <strong>{{ i18n.t('common.login') }}</strong>: {{ i18n.t('pages.help.login') }}
        </div>
        <div>
          <strong>{{ i18n.t('common.upload') }}</strong>: {{ i18n.t('pages.help.upload') }}
        </div>
        <div>
          <strong>{{ i18n.t('reader.page_single') }}</strong>: {{ i18n.t('pages.help.reader') }}
        </div>
        <div>
          <strong>Downloads &amp; Streaming</strong>: {{ i18n.t('pages.help.downloads') }}
        </div>
        <div>
          <strong>{{ i18n.t('common.theme') }}</strong>: {{ i18n.t('pages.help.theme') }}
        </div>
        <div>
          <strong>Effekte</strong>: {{ i18n.t('pages.help.effects') }}
        </div>
        <div>
          <strong>{{ i18n.t('common.admin') }}</strong>: {{ i18n.t('pages.help.admin') }}
        </div>
        <div>
          <strong>{{ i18n.t('pages.admin.maintenance') }}</strong>: {{ i18n.t('pages.help.keyboard') }}
        </div>
      </div>
    </div>
  </div>
  `
})
export class HelpModalComponent {
  constructor(public i18n: I18nService) { }
  @Input() open = false
  @Input() dayMode = true
  @Output() close = new EventEmitter<void>()
}


