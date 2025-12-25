import { Component, NgZone, ViewChild, ElementRef } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../services/api.service'
import { HapticsService } from '../services/haptics.service'
import { BurstService } from '../services/burst.service'
import { ToastService } from '../services/toast.service'

@Component({
  standalone: true,
  selector: 'app-upload',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="max-w-xl mx-auto card space-y-4">
      <h1 class="text-lg font-bold">Upload</h1>
      <p class="text-sm text-gray-600">
        Unterstützte Formate: PDF, EPUB, CBZ/ZIP oder ZIP mit Bilder-Ordnern. Die Dateien landen in
        <code>storage/originals</code>.
      </p>
      <form (ngSubmit)="submit()" class="space-y-3">
        <div class="grid gap-2">
          <label class="text-sm font-medium" for="title">Titel *</label>
          <input id="title" type="text" class="w-full border p-2 rounded" placeholder="Titel" [(ngModel)]="title" name="title" required />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium" for="author">Autor / Zeichner</label>
          <input id="author" type="text" class="w-full border p-2 rounded" placeholder="Autor" [(ngModel)]="author" name="author" />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium" for="language">Sprache</label>
          <input id="language" type="text" class="w-full border p-2 rounded" placeholder="z. B. de, en, ja" [(ngModel)]="language" name="language" />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium" for="tags">Tags (Komma-getrennt)</label>
          <input id="tags" type="text" class="w-full border p-2 rounded" placeholder="Action, Romance" [(ngModel)]="tags" name="tags" />
        </div>

        <div class="space-y-2" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
          <label class="text-sm font-medium">Datei</label>
          <input #fileInput type="file" accept=".pdf,.epub,.cbz,.zip" (change)="onFile($event)" />
          <p *ngIf="file" class="text-xs text-gray-500">Ausgewählt: {{ file?.name }}</p>
          <div *ngIf="dragActive" class="text-xs text-gray-500">Datei hier ablegen…</div>
        </div>

        <button class="bg-matcha text-white px-4 py-2 rounded w-full transition-all disabled:opacity-50" [disabled]="busy" type="button" (click)="submit()">
          {{ busy ? 'Upload läuft...' : 'Hochladen' }}
        </button>
      </form>

      <div *ngIf="busy" class="space-y-2 pt-4">
        <div class="h-2 bg-gray-200 rounded overflow-hidden">
          <div class="h-full bg-kurenai transition-all duration-300" [style.width.%]="progress"></div>
        </div>
        <div class="text-xs text-gray-500 text-center font-mono">{{ progress }} %</div>
      </div>
    </section>
  `
})
export class UploadPage {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>
  title = ''
  author = ''
  language = ''
  tags = ''
  file?: File
  busy = false
  progress = 0
  dragActive = false

  constructor(
    private api: ApiService,
    private bursts: BurstService,
    private toast: ToastService,
    private haptics: HapticsService,
    private zone: NgZone
  ) { }

  onFile(event: Event) {
    const files = (event.target as HTMLInputElement).files
    this.file = files && files.length ? files[0] : undefined
  }

  onDragOver(event: DragEvent) {
    event.preventDefault()
    this.dragActive = true
    this.haptics.tap()
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault()
    this.dragActive = false
  }

  onDrop(event: DragEvent) {
    event.preventDefault()
    this.dragActive = false
    if (event.dataTransfer?.files?.length) {
      this.file = event.dataTransfer.files[0]
      this.haptics.tap()
    }
  }

  async submit() {
    if (this.busy || !this.file) {
      if (!this.file) this.toast.show('Bitte eine Datei auswählen.', 'error')
      return
    }
    const form = new FormData()
    form.set('title', this.title.trim())
    form.set('author', this.author.trim())
    form.set('language', this.language.trim())
    form.set('tags', this.tags)
    form.set('file', this.file)

    this.busy = true
    this.progress = 0
    try {
      this.bursts.trigger(16)
      await this.uploadWithProgress(form)
      this.bursts.trigger(24)
      this.haptics.success()
      this.toast.show('Upload erfolgreich abgeschlossen', 'success')
      this.resetForm()
    } catch (err) {
      console.error(err)
      this.haptics.error()
      this.toast.show('Fehler beim Upload', 'error')
    } finally {
      this.zone.run(() => {
        this.busy = false
        this.progress = 0
      })
    }
  }

  private resetForm() {
    this.zone.run(() => {
      this.title = ''
      this.author = ''
      this.language = ''
      this.tags = ''
      this.file = undefined
      if (this.fileInput) this.fileInput.nativeElement.value = ''
    })
  }

  private uploadWithProgress(form: FormData) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${this.api.base}/api/books/upload`)
      const token = this.api.token()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (event) => {
        this.zone.run(() => {
          if (event.lengthComputable) {
            this.progress = Math.min(100, Math.round((event.loaded / event.total) * 100))
          }
        })
      }

      xhr.onerror = () => this.zone.run(() => reject(new Error('Upload fehlgeschlagen')))
      xhr.onload = () => {
        this.zone.run(() => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(xhr.statusText))
          }
        })
      }

      xhr.send(form)
    })
  }
}
