import { Component, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { ApiService, Book } from '../services/api.service'
import { BurstService } from '../services/burst.service'

@Component({
  standalone: true,
  selector: 'app-library',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3 items-center">
      <input class="border p-2 rounded col-span-2" placeholder="Suchen..." (input)="onQuery($event)" />
      <select class="border p-2 rounded" (change)="onFormat($event)">
        <option value="">Alle Formate</option>
        <option value="pdf">PDF</option>
        <option value="epub">EPUB</option>
        <option value="cbz">CBZ</option>
        <option value="images">Bilder</option>
      </select>
      <select class="border p-2 rounded" (change)="onTag($event)">
        <option value="">Alle Tags</option>
        <option *ngFor="let t of tags()" [value]="t">{{ t }}</option>
      </select>
    </div>
    <div class="grid gap-3" [ngStyle]="{'grid-template-columns': gridCols}">
      <div class="card hover:shadow-lg transition relative" *ngFor="let b of books()" (mouseenter)="pop($event)">
        <button *ngIf="api.role()==='admin' || api.role()==='editor'" class="absolute top-2 right-2 bg-kurenai text-white rounded-full w-7 h-7" (click)="remove(b.id, $event)">✕</button>
        <a [routerLink]="['/reader', b.id]">
          <img *ngIf="b.coverPath" [src]="api.base + b.coverPath" alt="cover" class="w-full h-48 object-cover rounded" loading="lazy" />
          <div class="mt-2 font-semibold">{{ b.title }}</div>
          <div class="text-sm text-gray-600">{{ b.author || 'Unbekannt' }}</div>
        </a>
      </div>
    </div>
  `
})
export class LibraryPage {
  books = signal<Book[]>([])
  tags = signal<string[]>([])
  gridCols = 'repeat(auto-fill, minmax(140px, 1fr))'
  query = ''
  format = ''
  tag = ''
  constructor(public api: ApiService, private bursts: BurstService) { this.load(); this.loadTags() }
  async load() { this.books.set(await this.api.listBooks({ query: this.query, format: this.format, tag: this.tag })) }
  async loadTags() { this.tags.set(await this.api.getTags()) }
  onQuery(e: any) { this.query = (e.target as HTMLInputElement).value; this.load() }
  onFormat(e: any) { this.format = (e.target as HTMLSelectElement).value; this.load() }
  onTag(e: any) { this.tag = (e.target as HTMLSelectElement).value; this.load() }
  async remove(id: number, ev: Event) { ev.stopPropagation(); ev.preventDefault(); if (confirm('Wirklich löschen?')) { try { await this.api.deleteBook(id); await this.load() } catch { alert('Löschen fehlgeschlagen') } } }
  pop(e: MouseEvent) { this.bursts.trigger(6, { x: e.clientX, y: e.clientY }) }
}

