import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { ApiService, Book } from '../services/api.service'
import { BurstService } from '../services/burst.service'
import { signal } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-library',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="grid gap-3 md:grid-cols-6 mb-4">
      <input class="border p-2 rounded md:col-span-2" placeholder="Suche / Title" (input)="onQuery($event)" />
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
      <select class="border p-2 rounded" (change)="onLanguage($event)">
        <option value="">Alle Sprachen</option>
        <option *ngFor="let l of languages()" [value]="l">{{ l }}</option>
      </select>
      <select class="border p-2 rounded" (change)="onSort($event)">
        <option value="createdAt.desc">Neueste zuerst</option>
        <option value="createdAt.asc">Aelteste zuerst</option>
        <option value="title.asc">Titel A-Z</option>
        <option value="title.desc">Titel Z-A</option>
        <option value="updatedAt.desc">Zuletzt aktualisiert</option>
      </select>
    </section>

    <div class="grid gap-3" [ngStyle]="{ 'grid-template-columns': gridCols }">
      <article class="card hover:shadow-lg transition relative group" *ngFor="let b of books()" (mouseenter)="pop($event)">
        <a
          class="absolute top-2 left-2 bg-matcha text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
          [href]="downloadHref(b)"
          (click)="$event.stopPropagation()"
          download
          title="Original herunterladen"
          aria-label="Original herunterladen"
        >DL</a>
        <button
          class="absolute top-2 left-12 bg-gray-200 text-aizome rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
          (click)="toggleMenu(b.id, $event)"
          title="Mehr Optionen"
          aria-label="Mehr Optionen"
        >⋮</button>
        <div *ngIf="openMenuFor===b.id" class="absolute z-20 top-12 left-2 bg-white border rounded shadow text-sm p-2 min-w-[160px]" (click)="$event.stopPropagation()">
          <a class="block px-2 py-1 hover:bg-gray-100 rounded" [href]="downloadHref(b)" download>Original herunterladen</a>
        </div>
        <button
          *ngIf="api.role() === 'admin' || api.role() === 'editor'"
          class="absolute top-2 right-2 bg-kurenai text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
          (click)="remove(b.id, $event)"
          aria-label="Buch Loeschen"
        >
          X
        </button>
        <a [routerLink]="['/reader', b.id]" class="block">
          <div class="aspect-[2/3] bg-kumo rounded overflow-hidden flex items-center justify-center">
            <img
              *ngIf="b.coverPath"
              [src]="api.base + b.coverPath"
              [alt]="b.title"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <span *ngIf="!b.coverPath" class="text-xs text-gray-500">Kein Cover</span>
          </div>
          <div class="mt-2 font-semibold truncate">{{ b.title }}</div>
          <div class="text-sm text-gray-600 truncate">{{ b.author || 'Unbekannt' }}</div>
          <div class="text-xs text-gray-500 flex gap-2 mt-1">
            <span>{{ b.format | uppercase }}</span>
            <span *ngIf="b.language">* {{ b.language }}</span>
            <span *ngIf="b.pageCount">* {{ b.pageCount }} Seiten</span>
          </div>
        </a>
      </article>
    </div>

    <div class="flex items-center justify-center py-6" *ngIf="loading()">
      <span class="text-sm text-gray-500 animate-pulse">Lade ...</span>
    </div>

    <div #sentinel class="h-4"></div>
  `
})
export class LibraryPage implements AfterViewInit, OnDestroy {
  books = signal<Book[]>([])
  tags = signal<string[]>([])
  languages = signal<string[]>([])
  loading = signal(false)
  hasMore = signal(false)

  gridCols = 'repeat(auto-fill, minmax(150px, 1fr))'

  private query = ''
  private format = ''
  private tag = ''
  private language = ''
  private sort = 'createdAt.desc'
  private page = 1
  private observer?: IntersectionObserver
  openMenuFor: number | null = null

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLDivElement>

  constructor(public api: ApiService, private bursts: BurstService) {
    this.loadInitial()
  }

  async loadInitial() {
    await Promise.all([this.load(true), this.loadTags(), this.loadLanguages()])
  }

  async load(reset = false) {
    if (this.loading()) return
    if (reset) {
      this.page = 1
      this.books.set([])
      this.hasMore.set(false)
    }
    this.loading.set(true)
    try {
      const { items, pagination } = await this.api.listBooks({
        query: this.query,
        format: this.format,
        tag: this.tag,
        lang: this.language,
        sort: this.sort,
        page: this.page,
        limit: 24
      })
      if (this.page === 1) {
        this.books.set(items)
      } else {
        this.books.update((prev) => [...prev, ...items])
      }
      this.hasMore.set(pagination.hasMore)
      if (pagination.hasMore) {
        this.page = pagination.page + 1
      }
    } finally {
      this.loading.set(false)
    }
  }

  async loadTags() {
    this.tags.set(await this.api.getTags())
  }

  async loadLanguages() {
    this.languages.set(await this.api.getLanguages())
  }

  downloadHref(b: Book) {
    const token = this.api.token()
    const url = new URL(`${this.api.base}/api/books/${b.id}/download`)
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  toggleMenu(id: number, ev: Event) {
    ev.stopPropagation()
    this.openMenuFor = this.openMenuFor === id ? null : id
  }

  onQuery(event: Event) {
    this.query = (event.target as HTMLInputElement).value.trim()
    this.load(true)
  }

  onFormat(event: Event) {
    this.format = (event.target as HTMLSelectElement).value
    this.load(true)
  }

  onTag(event: Event) {
    this.tag = (event.target as HTMLSelectElement).value
    this.load(true)
  }

  onLanguage(event: Event) {
    this.language = (event.target as HTMLSelectElement).value
    this.load(true)
  }

  onSort(event: Event) {
    this.sort = (event.target as HTMLSelectElement).value
    this.load(true)
  }

  async remove(id: number, ev: Event) {
    ev.stopPropagation()
    ev.preventDefault()
    if (!confirm('Wirklich Loeschen?')) return
    try {
      await this.api.deleteBook(id)
      await this.load(true)
    } catch {
      alert('Loeschen fehlgeschlagen')
    }
  }

  pop(e: MouseEvent) {
    this.bursts.trigger(8, { x: e.clientX, y: e.clientY })
  }

  ngAfterViewInit(): void {
    if (!('IntersectionObserver' in globalThis)) return
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && this.hasMore() && !this.loading()) {
        this.load()
      }
    }, { threshold: 0.2 })
    if (this.sentinel?.nativeElement) {
      this.observer.observe(this.sentinel.nativeElement)
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect()
  }
}




