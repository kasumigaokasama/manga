import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, HostListener } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { ApiService, Book } from '../services/api.service'
import { SettingsService } from '../services/settings.service'
import { BurstService } from '../services/burst.service'
import { signal } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-library',
  imports: [CommonModule, RouterLink],
  template: `
    <!-- Mobile filter toggle -->
    <div class="mb-2 md:hidden">
      <button class="px-3 py-2 border rounded text-sm" (click)="filtersOpen = !filtersOpen" [attr.aria-expanded]="filtersOpen" aria-controls="filters"><span class="material-icons" aria-hidden="true">more_horiz</span></button>
    </div>
    <section id="filters" class="mb-4" [ngClass]="{'hidden': !filtersOpen, 'block': filtersOpen, 'md:grid': true}" [class.grid]="filtersOpen">
      <div class="grid gap-3 md:grid-cols-6">
      <input class="border p-2 rounded md:col-span-2" placeholder="Suche / Title" (input)="onQuery($event)" />
      <select class="border p-2 rounded" (change)="onFormat($event)">
        <option value="">Alle Formate</option>
        <option *ngFor="let f of formatSelect()" [value]="f">{{ f || 'Alle' }}</option>
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
        <option *ngFor="let s of sortSelect()" [selected]="s===sort" [value]="s">{{ s }}</option>
      </select>
      </div>
    </section>

    <div class="flex items-center justify-end mb-2">
      <button class="text-xs px-3 py-1 border rounded" (click)="toggleCompact()"><span class="material-icons" aria-hidden="true">more_horiz</span></button>
    </div>

    <div class="grid gap-3" [ngStyle]="{ 'grid-template-columns': gridCols }">
      <article class="card hover:shadow-lg transition relative group" *ngFor="let b of books()" (mouseenter)="pop($event)">
        <a
          class="absolute top-2 left-2 bg-matcha text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
          href="#"
          (click)="downloadBook(b, $event)"
          title="Original herunterladen"
          aria-label="Original herunterladen"
        >
          <span class="material-icons" aria-hidden="true">file_download</span>
        </a>
        <button
          class="absolute top-2 left-12 bg-gray-200 text-aizome rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
          (click)="toggleMenu(b.id, $event)"
          title="Mehr Optionen"
          aria-label="Mehr Optionen"
        ><span class="material-icons" aria-hidden="true">more_horiz</span></button>
        <div *ngIf="openMenuFor===b.id" class="absolute z-20 top-12 left-2 bg-white border rounded shadow text-sm p-2 min-w-[160px]" (click)="$event.stopPropagation()">
          <button class="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded" (click)="downloadBook(b, $event)">Original herunterladen</button>
        </div>
        <button
          *ngIf="api.role() === 'admin' || api.role() === 'editor'"
          class="absolute top-2 right-2 bg-kurenai text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
          (click)="remove(b.id, $event)"
          aria-label="Buch löschen"
        >
          <span class="material-icons" aria-hidden="true">delete</span><span class="material-icons" aria-hidden="true">more_horiz</span></button>
        <a [routerLink]="['/reader', b.id]" class="block">
          <div class="aspect-[2/3] bg-kumo rounded overflow-hidden flex items-center justify-center relative">
            <img
              *ngIf="b.coverPath"
              [src]="coverSrc(b)"
              [alt]="b.title"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <span *ngIf="settings.showOfflineBadge() && coverCached()[b.id]" class="absolute top-1 right-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded shadow" title="Aus Cache">offline</span>
            <span *ngIf="!b.coverPath" class="text-xs text-gray-500">Kein Cover</span>
          </div>
          <div class="mt-2 font-semibold truncate">{{ b.title }}</div>
          <div class="text-sm text-gray-600 truncate" *ngIf="!compact">{{ b.author || 'Unbekannt' }}</div>
          <div class="text-xs text-gray-500 flex gap-2 mt-1" *ngIf="!compact">
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

    <!-- Back to top (mobile) -->
    <button
      *ngIf="showTop"
      class="fixed bottom-20 right-4 md:hidden bg-aizome text-white rounded-full shadow-lg w-10 h-10 flex items-center justify-center"
      (click)="scrollTop()"
      aria-label="Nach oben">
      <span class="material-icons" aria-hidden="true">arrow_upward</span><span class="material-icons" aria-hidden="true">more_horiz</span></button>
  `
})
export class LibraryPage implements AfterViewInit, OnDestroy {
  books = signal<Book[]>([])
  tags = signal<string[]>([])
  languages = signal<string[]>([])
  loading = signal(false)
  hasMore = signal(false)
  coverCached = signal<Record<number, boolean>>({})

  gridCols = 'repeat(auto-fill, minmax(150px, 1fr))'

  private query = ''
  private format = ''
  private tag = ''
  private language = ''
  sort = 'createdAt.desc'
  private page = 1
  private observer?: IntersectionObserver
  openMenuFor: number | null = null
  filtersOpen = false
  compact = false
  showTop = false
  private coverUrls: Record<number, string> = {}

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLDivElement>

  constructor(public api: ApiService, private bursts: BurstService, public settings: SettingsService) {
    this.loadInitial()
  }

  tagsSelect() { try { return [''].concat(this.tags()) } catch { return [''] } }
  languagesSelect() { try { return [''].concat(this.languages()) } catch { return [''] } }
  formatSelect() { return ['', 'pdf', 'epub', 'cbz', 'images'] }
  sortSelect() {
    return [
      'createdAt.desc',
      'createdAt.asc',
      'title.asc',
      'title.desc',
      'updatedAt.desc'
    ]
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
      // Prefetch covers with Authorization
      try {
        for (const b of items) {
          if (b.coverPath) this.fetchCover(b)
        }
      } catch { }
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

  async downloadBook(b: Book, ev?: Event) {
    ev?.preventDefault(); ev?.stopPropagation()
    try {
      const url = `${this.api.base}/api/books/${b.id}/download`
      const token = this.api.token()
      const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error('Download failed')
      const blob = await r.blob()
      const cd = r.headers.get('content-disposition') || ''
      const match = cd.match(/filename="?([^";]+)"?/i)
      const name = match?.[1] || (b.title?.replace(/\s+/g, '_') + (b.format ? '.' + b.format : '')) || 'download'
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(obj), 1000)
    } catch { }
  }

  coverSrc(b: Book) {
    const url = this.coverUrls[b.id]
    if (url) return url
    this.fetchCover(b)
    return ''
  }

  private async fetchCover(b: Book) {
    try {
      if (!b.coverPath) return
      const token = this.api.token()
      const r = await fetch(this.api.base + b.coverPath, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) return
      const blob = await r.blob()
      const obj = URL.createObjectURL(blob)
      if (this.coverUrls[b.id]) { try { URL.revokeObjectURL(this.coverUrls[b.id]) } catch { } }
      this.coverUrls[b.id] = obj
    } catch { }
  }

  onCoverLoad(b: Book) {
    if (!b.coverPath) return
    try {
      // Try to match same-origin SW cache when applicable
      const abs = new URL(this.api.base + b.coverPath)
      let lookup = abs
      try { if (abs.origin === location.origin) lookup = new URL(abs.pathname + abs.search, location.origin) } catch { }
      const key = lookup.toString()
      if ('caches' in window) {
        caches.match(key, { ignoreSearch: true } as any).then((resp) => {
          if (resp) this.coverCached.update((m) => ({ ...m, [b.id]: true }))
        }).catch(() => { })
      }
    } catch { /* ignore */ }
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

  // DevExtreme handlers removed

  toggleCompact() {
    this.compact = !this.compact
    this.gridCols = this.compact ? 'repeat(auto-fill, minmax(120px, 1fr))' : 'repeat(auto-fill, minmax(150px, 1fr))'
  }

  async remove(id: number, ev: Event) {
    ev.stopPropagation()
    ev.preventDefault()
    if (!confirm('Wirklich Löschen?')) return
    try {
      await this.api.deleteBook(id)
      await this.load(true)
    } catch {
      alert('Löschen fehlgeschlagen')
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
    for (const k of Object.keys(this.coverUrls)) {
      try { URL.revokeObjectURL(this.coverUrls[Number(k)]) } catch { }
    }
  }

  @HostListener('window:scroll')
  onScroll() {
    try { this.showTop = (window?.scrollY || 0) > 300 } catch { this.showTop = false }
  }

  scrollTop() {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { }
  }
}







