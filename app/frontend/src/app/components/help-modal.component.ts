import { Component, EventEmitter, Input, Output } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-help-modal',
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
    .panel { max-width: 720px; width: 90%; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.2) }
  `],
  template: `
  <div class="backdrop" *ngIf="open" (click)="close.emit()">
    <div class="panel" (click)="$event.stopPropagation()"
         [ngClass]="{'bg-white text-aizome': dayMode, 'bg-slate-800 text-slate-100': !dayMode}">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-bold">Hilfe & Schnelltest</h2>
        <button class="border px-2 py-1 rounded" (click)="close.emit()">Schließen</button>
      </div>
      <div class="text-sm space-y-2">
        <div>
          <strong>Login</strong>: adminexample.com / ChangeThis123!
        </div>
        <div>
          <strong>Upload</strong>: CBZ/PDF hochladen → Bibliothek zeigt Cover bzw. Reader-Link.
        </div>
        <div>
          <strong>Reader</strong>: Pfeile / Tippen zum Blättern, Scrubber unten, RTL/2‑up umschalten.
        </div>
        <div>
          <strong>Theme</strong>: Toolbar „Theme ▾“ → Presets (Day/Night/Minimal), Stars/Blüten ein/aus.
        </div>
        <div>
          <strong>Effekte</strong>: Petal‑Bursts bei Login/Upload; Sound in Einstellungen aktivierbar.
        </div>
        <div>
          <strong>Admin</strong>: Seite /admin für Benutzerverwaltung; Audit‑Log live.
        </div>
      </div>
    </div>
  </div>
  `
})
export class HelpModalComponent {
  @Input() open = false
  @Input() dayMode = true
  @Output() close = new EventEmitter<void>()
}

