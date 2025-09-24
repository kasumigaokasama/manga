import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../services/api.service'
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
        Unterstuetzte Formate: PDF, EPUB, CBZ/ZIP oder ZIP mit Bilder-Ordnern. Die Dateien landen in
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

        <div
          class="border-2 border-dashed rounded-lg p-6 text-center transition"
          [class.border-kurenai]="dragActive"
          [class.bg-sakura]="dragActive"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
        >
          <p class="mb-2">Datei hier ablegen oder auswaehlen</p>
          <input type="file" class="w-full" (change)="onFile($event)" />
          <p *ngIf="file" class="mt-2 text-sm text-gray-600">Ausgewaehlt: {{ file?.name }}</p>
        </div>

        <button class="bg-matcha text-white px-4 py-2 rounded w-full" [disabled]="busy">
          {{ busy ? 'Upload laeuft...' : 'Hochladen' }}
        </button>
      </form>

      <div *ngIf="busy" class="space-y-2">
        <div class="h-2 bg-gray-200 rounded">
          <div class="h-2 bg-kurenai rounded" [style.width.%]="progress"></div>
        </div>
        <div class="text-xs text-gray-500 text-center">{{ progress }} %</div>
      </div>
    </section>
  `
})
export class UploadPage {
  title = ''
  author = ''
  language = ''
  tags = ''
  file?: File
  busy = false
  progress = 0
  dragActive = false

  constructor(private api: ApiService, private bursts: BurstService, private toast: ToastService) {}

  onFile(event: Event) {
    const files = (event.target as HTMLInputElement).files
    this.file = files && files.length ? files[0] : undefined
  }

  onDragOver(event: DragEvent) {
    event.preventDefault()
    this.dragActive = true
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
    }
  }

  async submit() {
    if (!this.file) {
      this.toast.show('Bitte eine Datei auswaehlen.', 'error')
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
      this.toast.show('Upload erfolgreich abgeschlossen', 'success')
      this.resetForm()
    } catch (err) {
      console.error(err)
      this.toast.show('Fehler beim Upload', 'error')
    } finally {
      this.busy = false
    }
  }

  private resetForm() {
    this.title = ''
    this.author = ''
    this.language = ''
    this.tags = ''
    this.file = undefined
    this.progress = 0
  }

  private uploadWithProgress(form: FormData) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${this.api.base}/api/books/upload`)
      const token = this.api.token()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          this.progress = Math.min(100, Math.round((event.loaded / event.total) * 100))
        }
      }

      xhr.onerror = () => reject(new Error('Upload fehlgeschlagen'))
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(xhr.statusText))
        }
      }

      xhr.send(form)
    })
  }
}

