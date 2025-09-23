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
    <div class="max-w-xl mx-auto card">
      <h1 class="text-lg font-bold mb-2">Upload</h1>
      <form (ngSubmit)="submit()" class="space-y-3">
        <input type="text" class="w-full border p-2 rounded" placeholder="Titel" [(ngModel)]="title" name="title" required />
        <input type="text" class="w-full border p-2 rounded" placeholder="Autor" [(ngModel)]="author" name="author" />
        <input type="text" class="w-full border p-2 rounded" placeholder="Tags (Komma-getrennt)" [(ngModel)]="tags" name="tags" />
        <input type="file" class="w-full" (change)="onFile($event)" />
        <button class="bg-matcha text-white px-4 py-2 rounded">Hochladen</button>
        <div *ngIf="busy" class="text-sm text-gray-600">Lade hoch…</div>
      </form>
    </div>
  `
})
export class UploadPage {
  title = ''
  author = ''
  tags = ''
  file?: File
  busy = false
  constructor(private api: ApiService, private bursts: BurstService, private toast: ToastService) {}
  onFile(e: any) { this.file = e.target.files?.[0] }
  async submit() {
    if (!this.file) return alert('Datei wählen')
    const form = new FormData()
    form.set('title', this.title)
    form.set('author', this.author)
    form.set('tags', this.tags)
    form.set('file', this.file)
    try {
      this.busy = true
      this.bursts.trigger(24)
      await this.api.uploadBook(form)
      this.bursts.trigger(18)
      this.toast.show('Upload erfolgreich', 'success')
    } catch {
      this.toast.show('Fehler beim Upload', 'error')
    } finally {
      this.busy = false
    }
  }
}
