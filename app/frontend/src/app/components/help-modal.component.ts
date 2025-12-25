import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'

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
        <h2 class="text-lg font-bold">Hilfe &amp; Schnelltest</h2>
        <button class="border px-2 py-1 rounded" (click)="close.emit()">Schließen</button>
      </div>
      <div class="text-sm space-y-2">
        <div>
          <strong>Login</strong>: admin@example.com / ChangeThis123!
        </div>
        <div>
          <strong>Upload</strong>: CBZ/PDF hochladen &rarr; Bibliothek zeigt Cover bzw. Reader-Link.
        </div>
        <div>
          <strong>Reader</strong>: Pfeile/Tippen zum Blättern, Scrubber unten, RTL/2-up umschalten.
        </div>
        <div>
          <strong>Downloads &amp; Streaming</strong>: EPUB via <code>/api/books/:id/download</code>. PDFs per Range-Streaming (<code>GET /api/books/:id/stream</code>), Metadaten via <code>HEAD</code>.
        </div>
        <div>
          <strong>Theme</strong>: Toolbar &bdquo;Theme&ldquo; &rarr; Presets (Day/Night/Minimal), Sterne/Blüten ein/aus.
        </div>
        <div>
          <strong>Effekte</strong>: Petal-Bursts bei Login/Upload; Sound in Einstellungen aktivierbar.
        </div>
        <div>
          <strong>Admin</strong>: Seite /admin für Benutzerverwaltung; Audit-Log live.
        </div>
        <div>
          <strong>Tastatur</strong>: &larr;/&rarr; Blättern (RTL respektiert), [ / ] Zoom, F Vollbild, R Richtung, S Spread, D Sakura.
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


