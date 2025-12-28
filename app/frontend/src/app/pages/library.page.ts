import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, HostListener, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { ApiService, Book } from '../services/api.service'
import { SettingsService } from '../services/settings.service'
import { BurstService } from '../services/burst.service'
import { I18nService } from '../services/i18n.service'
import { ConfirmModalComponent } from '../components/confirm-modal.component'
import { ThemeService } from '../services/theme.service'

@Component({
  standalone: true,
  selector: 'app-library',
  imports: [CommonModule, RouterLink, ConfirmModalComponent],
  template: `
    <!-- Mobile filter toggle -->
    <div class="mb-2 md:hidden">
      <button class="px-3 py-2 border rounded text-sm" (click)="filtersOpen = !filtersOpen" [attr.aria-expanded]="filtersOpen" aria-controls="filters"><span class="material-icons" aria-hidden="true">more_horiz</span></button>
    </div>
    <section id="filters" class="mb-4" [ngClass]="{'hidden': !filtersOpen, 'block': filtersOpen, 'md:grid': true}" [class.grid]="filtersOpen">
      <div class="grid gap-3 md:grid-cols-6">
      <input class="border p-2 rounded md:col-span-2" [placeholder]="i18n.t('pages.library.search_placeholder')" (input)="onQuery($event)" />
      <select class="border p-2 rounded" (change)="onFormat($event)">
        <option value="">{{ i18n.t('pages.library.all_formats') }}</option>
        <option *ngFor="let f of formatSelect()" [value]="f">{{ f || i18n.t('common.none') }}</option>
      </select>
      <select class="border p-2 rounded" (change)="onTag($event)">
        <option value="">{{ i18n.t('pages.library.all_tags') }}</option>
        <option *ngFor="let t of tags()" [value]="t">{{ t }}</option>
      </select>
      <select class="border p-2 rounded" (change)="onLanguage($event)">
        <option value="">{{ i18n.t('pages.library.all_languages') }}</option>
        <option *ngFor="let l of languages()" [value]="l">{{ l }}</option>
      </select>
      <select class="border p-2 rounded" (change)="onSort($event)">
        <option *ngFor="let s of sortSelect()" [selected]="s===sort" [value]="s">{{ i18n.t('sort_options.' + s.replace('.', '_')) }}</option>
      </select>
      </div>
    </section>

    <div class="flex items-center justify-end mb-2">
      <button class="text-xs px-3 py-1 border rounded" (click)="toggleCompact()" [title]="i18n.t('pages.library.compact_view')" [aria-label]="i18n.t('pages.library.compact_view')"><span class="material-icons" aria-hidden="true">more_horiz</span></button>
    </div>

    <div class="grid gap-3" [ngStyle]="{ 'grid-template-columns': gridCols }">
      <article class="card hover:shadow-2xl transition-all duration-300 relative group overflow-hidden bg-white rounded-2xl" 
               *ngFor="let b of books()" 
               (mouseenter)="pop($event)"
               tabindex="0"
               [attr.aria-label]="b.title"
               (keydown)="handleKey($event, b)">
        <a [routerLink]="['/reader', b.id]" class="block relative">
          <div class="aspect-[2/3] bg-gray-100 rounded-t-2xl overflow-hidden flex items-center justify-center relative">
            <!-- Skeleton Loader -->
            <div *ngIf="!coverLoaded[b.id] && b.coverPath" class="absolute inset-0 skeleton-pulse z-10"></div>
            
            <img
              *ngIf="b.coverPath"
              [src]="coverSrc(b)"
              [alt]="b.title"
              class="w-full h-full object-cover transition-all duration-500 transform group-hover:scale-105"
              [class.opacity-0]="!coverLoaded[b.id]"
              (load)="coverLoaded[b.id] = true"
              loading="lazy"
            />
            
            <!-- Badges -->
            <div class="absolute top-2 left-2 flex flex-col gap-1.5 z-20">
              <span *ngIf="isNew(b)" class="glass px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm uppercase tracking-wider">NEW</span>
              <span *ngIf="settings.showOfflineBadge() && coverCached()[b.id]" class="bg-amber-500/80 backdrop-blur-sm border border-amber-400/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm uppercase tracking-wider">{{ i18n.t('pages.library.offline_badge') }}</span>
            </div>

            <div *ngIf="!b.coverPath" class="text-xs text-gray-400 flex flex-col items-center gap-2">
              <span class="material-icons opacity-20 text-5xl">auto_stories</span>
              <span class="font-medium">{{ i18n.t('pages.library.no_cover') }}</span>
            </div>
            
            <!-- Bottom Action Overlay (Glassmorphism) -->
            <div class="absolute inset-x-0 bottom-0 p-3 glass translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex justify-center gap-6 z-30">
              <button
                class="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 hover:bg-white text-matcha shadow-lg transition-all active:scale-95"
                (click)="askDownload(b, $event)"
                [title]="i18n.t('pages.library.download_original')"
                [aria-label]="i18n.t('pages.library.download_original')"
              >
                <span class="material-icons text-xl" aria-hidden="true">file_download</span>
              </button>
              <button
                *ngIf="api.role() === 'admin' || api.role() === 'editor'"
                class="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 hover:bg-white text-kurenai shadow-lg transition-all active:scale-95"
                (click)="askDelete(b, $event)"
                [title]="i18n.t('common.delete')"
                [aria-label]="i18n.t('common.delete')"
              >
                <span class="material-icons text-xl" aria-hidden="true">delete</span>
              </button>
            </div>

            <!-- Mobile Action Row (Visible on mobile instead of overlay) -->
            <div class="md:hidden absolute bottom-0 inset-x-0 p-2 flex justify-end gap-2 z-20 pointer-events-none">
              <div class="pointer-events-auto flex gap-1.5 translate-y-0 opacity-80">
                 <!-- Actions could be toggled or always shown compact on mobile -->
              </div>
            </div>
          </div>


          <div class="p-3">
            <div class="text-sm font-bold truncate group-hover:text-matcha transition-colors mb-0.5">{{ b.title }}</div>
            <div class="text-[11px] text-gray-500 truncate" *ngIf="!compact">{{ b.author || i18n.t('pages.library.author_unknown') }}</div>
            <div class="text-[10px] text-gray-400 flex items-center gap-2 mt-1.5 font-bold uppercase tracking-tight" *ngIf="!compact">
              <span class="bg-gray-100 px-1.5 py-0.5 rounded">{{ b.format }}</span>
              <span *ngIf="b.language" class="border-l border-gray-200 pl-2">{{ b.language }}</span>
              <span *ngIf="b.pageCount" class="border-l border-gray-200 pl-2">{{ i18n.t('reader.pages', { count: b.pageCount }) }}</span>
            </div>
          </div>
        </a>
      </article>
    </div>

    <div class="flex items-center justify-center py-6" *ngIf="loading()">
      <span class="text-sm text-gray-500 animate-pulse">{{ i18n.t('common.loading') }}</span>
    </div>

    <div #sentinel class="h-4"></div>

    <button
      *ngIf="showTop"
      class="fixed bottom-20 right-4 md:hidden bg-aizome text-white rounded-full shadow-lg w-10 h-10 flex items-center justify-center z-30"
      (click)="scrollTop()"
      [aria-label]="i18n.t('pages.library.back_to_top')">
      <span class="material-icons" aria-hidden="true">arrow_upward</span>
    </button>

    <!-- Modals -->
    <app-confirm-modal
      [open]="!!targetDelete"
      [title]="i18n.t('common.confirm')"
      [message]="i18n.t('pages.library.delete_book_confirm')"
      [danger]="true"
      [dayMode]="theme.sakura()"
      (confirm)="doDelete()"
      (cancel)="targetDelete = null"
    ></app-confirm-modal>

    <app-confirm-modal
      [open]="!!targetDownload"
      [title]="i18n.t('pages.library.download_original')"
      [message]="i18n.t('common.info')"
      [dayMode]="theme.sakura()"
      (confirm)="doDownload()"
      (cancel)="targetDownload = null"
    ></app-confirm-modal>
  `
})
export class LibraryPage implements AfterViewInit, OnDestroy {
  books = signal<Book[]>([])
  tags = signal<string[]>([])
  languages = signal<string[]>([])
  loading = signal(false)
  hasMore = signal(false)
  coverCached = signal<Record<number, boolean>>({})

  gridCols = 'repeat(auto-fill, minmax(180px, 1fr))'

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
  coverLoaded: Record<number, boolean> = {}

  targetDelete: Book | null = null
  targetDownload: Book | null = null

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLDivElement>


  constructor(public api: ApiService, private bursts: BurstService, public settings: SettingsService, public i18n: I18nService, public theme: ThemeService) {
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

  async askDownload(b: Book, ev?: Event) {
    ev?.preventDefault(); ev?.stopPropagation()
    this.targetDownload = b
  }

  async doDownload() {
    if (!this.targetDownload) return
    const b = this.targetDownload
    this.targetDownload = null
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

  async askDelete(b: Book, ev?: Event) {
    ev?.preventDefault(); ev?.stopPropagation()
    this.targetDelete = b
  }

  async doDelete() {
    if (!this.targetDelete) return
    const b = this.targetDelete
    this.targetDelete = null
    try {
      await this.api.deleteBook(b.id)
      this.coverLoaded = {} // Reset loading states to avoid flickering during reload
      await this.load(true)
    } catch {
      alert(this.i18n.t('pages.library.load_failed'))
    }
  }

  coverSrc(b: Book) {
    if (!b.coverPath) return ''
    const t = this.api.token()
    return `${this.api.base}${b.coverPath}${t ? '?token=' + t : ''}`
  }

  isNew(b: Book) {
    if (!b.createdAt) return false
    const d = new Date(b.createdAt)
    const diff = Date.now() - d.getTime()
    return diff < 7 * 24 * 60 * 60 * 1000 // 7 days
  }

  handleKey(ev: KeyboardEvent, b: Book) {
    if (ev.key === 'Delete' && (this.api.role() === 'admin' || this.api.role() === 'editor')) {
      this.askDelete(b)
    }
  }


  onCoverLoad(b: Book) {
    if (!b.coverPath) return
    try {
      const url = this.coverSrc(b)
      if ('caches' in window) {
        caches.match(url, { ignoreSearch: true } as any).then((resp) => {
          if (resp) this.coverCached.update((m) => ({ ...m, [b.id]: true }))
        }).catch(() => { })
      }
    } catch { /* ignore */ }
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
    this.gridCols = this.compact ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))'
  }

  async remove(id: number, ev: Event) {
    // legacy method, redirected via template to askDelete
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

  @HostListener('window:scroll')
  onScroll() {
    try { this.showTop = (window?.scrollY || 0) > 300 } catch { this.showTop = false }
  }

  scrollTop() {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { }
  }
}







