import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { signal } from '@angular/core'
import { ApiService, Book } from '../services/api.service'
import { SettingsService } from '../services/settings.service'
import { ThemeService } from '../services/theme.service'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs'

@Component({
  standalone: true,
  selector: 'app-reader',
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2 justify-between">
        <div class="font-semibold">
          Reader
          <span class="text-sm text-gray-500" *ngIf="totalPages">(Seite {{ page() }} / {{ totalPages }})</span>
        </div>
        <div class="flex flex-wrap gap-2 text-sm">
          <button class="px-2 py-1 bg-gray-200 rounded" (click)="toggleRtl()">Richtung: {{ rtl ? 'RTL' : 'LTR' }}</button>
          <button class="px-2 py-1 bg-gray-200 rounded" (click)="toggleSpread()">Spread: {{ spread ? '2-up' : '1-up' }}</button>
          <button class="px-2 py-1 bg-gray-200 rounded" (click)="zoomOut()">-</button>
          <button class="px-2 py-1 bg-gray-200 rounded" (click)="zoomIn()">+</button>
          <button class="px-2 py-1 bg-gray-200 rounded" (click)="fullscreen()">Fullscreen</button>
          <a [href]="downloadUrl()" download class="px-2 py-1 bg-matcha text-white rounded">Original</a>
          <button class="px-2 py-1 bg-gray-200 rounded" (click)="prev()">&larr;</button>
          <button class="px-2 py-1 bg-gray-200 rounded" (click)="next()">&rarr;</button>
        </div>
      </div>

      <div *ngIf="totalPages && format !== 'epub'">
        <input type="range" [min]="1" [max]="totalPages!" [value]="page()" (input)="onScrub($event)" class="w-full" />
      </div>

      <div *ngIf="format === 'pdf'" class="bg-black/5 rounded" (pointerdown)="onPointerDown($event)" (pointerup)="onPointerUp($event)">
        <canvas #pdfCanvas class="mx-auto block"></canvas>
      </div>

      <div *ngIf="format === 'epub'" class="p-6 border rounded bg-kumo text-center space-y-2">
        <p class="text-sm">EPUB-Dateien werden als Download ausgeliefert. Oeffne die Datei mit deinem bevorzugten Reader.</p>
        <a [href]="downloadUrl()" class="inline-block bg-matcha text-white px-4 py-2 rounded" download>EPUB herunterladen</a>
      </div>

      <div
        *ngIf="format !== 'pdf' && format !== 'epub'"
        class="flex gap-2 justify-center items-start"
        [style.direction]="rtl ? 'rtl' : 'ltr'"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
      >
        <img
          class="max-w-full"
          [style.transform]="'scale(' + zoom() + ')'"
          [src]="pageSrc(page())"
          alt="page"
        />
        <img
          *ngIf="spread"
          class="max-w-full"
          [style.transform]="'scale(' + zoom() + ')'"
          [src]="pageSrc(nextIndexForSpread())"
          alt="page2"
        />
      </div>

      <div *ngIf="format !== 'pdf' && format !== 'epub' && totalPages" class="mt-3 overflow-x-auto whitespace-nowrap py-2 border-t">
        <button
          *ngFor="let n of thumbPages()"
          class="inline-block mr-2 border rounded overflow-hidden focus:outline-none focus:ring"
          (click)="jump(n)"
          [class.ring-2]="n === page()"
        >
          <img [src]="pageSrc(n)" alt="thumb" width="80" height="120" loading="lazy" />
          <div class="text-center text-xs text-gray-600">{{ n }}</div>
        </button>
      </div>
    </div>
  `
})
export class ReaderPage implements OnDestroy {
  @ViewChild('pdfCanvas') pdfCanvas?: ElementRef<HTMLCanvasElement>

  id = 0
  page = signal(1)
  zoom = signal(1)
  rtl = true
  spread = false
  format: Book['format'] = 'images'
  totalPages: number | null = null

  private pdfDoc: PDFDocumentProxy | null = null
  private suppressSync = false
  private progressTimer?: any
  private prefetchTimer?: any
  private keyListener = (e: KeyboardEvent) => this.handleKey(e)
  private startX = 0
  private book?: Book

  constructor(
    private route: ActivatedRoute,
    public api: ApiService,
    private settings: SettingsService,
    private theme: ThemeService
  ) {
    this.id = Number(this.route.snapshot.paramMap.get('id'))
    this.rtl = this.settings.readerRtl()
    this.spread = this.settings.readerSpread()
    this.loadBook()
    this.loadProgress()
    window.addEventListener('keydown', this.keyListener)
  }

  async loadBook() {
    try {
      const { book } = await this.api.getBook(this.id)
      this.book = book
      this.format = book.format
      if (book.pageCount) this.totalPages = book.pageCount
      if (this.format === 'pdf') {
        await this.loadPdf()
      } else if (this.format !== 'epub') {
        this.prefetchImages()
      }
    } catch (err) {
      console.error('Konnte Buch nicht laden', err)
    }
  }

  async loadProgress() {
    try {
      const progress = await this.api.getProgress(this.id)
      if (progress?.page) {
        this.suppressSync = true
        this.page.set(Math.max(1, progress.page))
        this.suppressSync = false
        this.onPageChanged()
      } else {
        this.onPageChanged()
      }
    } catch {
      this.onPageChanged()
    }
  }

  private async loadPdf() {
    const headers: Record<string, string> = {}
    const token = this.api.token()
    if (token) headers['Authorization'] = `Bearer ${token}`
    const url = `${this.api.base}/api/books/${this.id}/stream`
    this.pdfDoc = await getDocument({ url, httpHeaders: headers }).promise
    try {
      this.totalPages = this.pdfDoc.numPages
    } catch {
      /* ignore */
    }
    await this.renderPdf()
  }

  private async renderPdf() {
    if (!this.pdfDoc) return
    const canvas = this.pdfCanvas?.nativeElement
    if (!canvas) return
    const current = Math.max(1, Math.min(this.pdfDoc.numPages, this.page()))
    const page = await this.pdfDoc.getPage(current)
    const viewport = page.getViewport({ scale: this.zoom() })
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    const renderContext = { canvasContext: ctx, viewport }
    await page.render(renderContext).promise
  }

  onPointerDown(ev: PointerEvent) {
    this.startX = ev.clientX
  }

  onPointerUp(ev: PointerEvent) {
    const dx = ev.clientX - this.startX
    if (Math.abs(dx) > 40) {
      if (dx > 0) {
        this.rtl ? this.next() : this.prev()
      } else {
        this.rtl ? this.prev() : this.next()
      }
    }
    this.startX = 0
  }

  next() {
    const delta = this.rtl ? -1 : 1
    this.setPage(this.page() + delta)
  }

  prev() {
    const delta = this.rtl ? 1 : -1
    this.setPage(this.page() + delta)
  }

  zoomIn() {
    this.zoom.set(Math.min(3, Number((this.zoom() + 0.1).toFixed(2))))
    if (this.format === 'pdf') this.renderPdf()
  }

  zoomOut() {
    this.zoom.set(Math.max(0.5, Number((this.zoom() - 0.1).toFixed(2))))
    if (this.format === 'pdf') this.renderPdf()
  }

  toggleRtl() {
    this.rtl = !this.rtl
    this.settings.setReaderRtl(this.rtl)
    this.prefetchImages()
    this.scheduleProgressSync()
  }

  toggleSpread() {
    this.spread = !this.spread
    this.settings.setReaderSpread(this.spread)
    this.prefetchImages()
  }

  fullscreen() {
    const target = this.pdfCanvas?.nativeElement?.parentElement || document.documentElement
    target.requestFullscreen?.()
  }

  onScrub(event: Event) {
    const value = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(value)) return
    this.setPage(value)
  }

  jump(n: number) {
    this.setPage(n)
  }

  nextIndexForSpread() {
    const delta = this.rtl ? -1 : 1
    const candidate = this.page() + delta
    if (!this.totalPages) return Math.max(1, candidate)
    return Math.min(this.totalPages, Math.max(1, candidate))
  }

  thumbPages(): number[] {
    if (!this.totalPages) return []
    const span = 6
    const current = this.page()
    const start = Math.max(1, current - span)
    const end = Math.min(this.totalPages, current + span)
    const arr: number[] = []
    for (let i = start; i <= end; i++) arr.push(i)
    return arr
  }

  pageSrc(n: number) {
    const safe = Math.max(1, n)
    const token = this.api.token()
    const url = new URL(`${this.api.base}/api/books/${this.id}/pages/${safe}`)
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  streamUrl() {
    const token = this.api.token()
    const url = new URL(`${this.api.base}/api/books/${this.id}/stream`)
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  downloadUrl() {
    const token = this.api.token()
    const url = new URL(`${this.api.base}/api/books/${this.id}/download`)
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  private setPage(newPage: number) {
    const max = this.totalPages ?? Number.MAX_SAFE_INTEGER
    const clamped = Math.max(1, Math.min(max, Math.floor(newPage)))
    this.page.set(clamped)
    this.onPageChanged()
  }

  private onPageChanged() {
    if (this.format === 'pdf') {
      this.renderPdf()
    } else if (this.format !== 'epub') {
      this.prefetchImages()
    }
    this.scheduleProgressSync()
  }

  private scheduleProgressSync() {
    if (this.suppressSync) return
    clearTimeout(this.progressTimer)
    this.progressTimer = setTimeout(() => {
      const current = this.page()
      const percent = this.computePercent(current)
      this.api.setProgress(this.id, current, percent).catch(() => {})
    }, 400)
  }

  private computePercent(page: number) {
    if (!this.totalPages || this.totalPages <= 0) return 0
    return Number(((page / this.totalPages) * 100).toFixed(2))
  }

  private prefetchImages() {
    if (this.format === 'pdf' || this.format === 'epub') return
    clearTimeout(this.prefetchTimer)
    this.prefetchTimer = setTimeout(() => {
      const current = this.page()
      const delta = this.rtl ? -1 : 1
      const candidates = [current + delta, current + 2 * delta]
      for (const n of candidates) {
        if (this.totalPages && (n < 1 || n > this.totalPages)) continue
        const img = new Image()
        img.src = this.pageSrc(n)
      }
    }, 200)
  }

  private handleKey(event: KeyboardEvent) {
    const key = event.key
    switch (key) {
      case 'ArrowRight':
        event.preventDefault()
        this.rtl ? this.prev() : this.next()
        break
      case 'ArrowLeft':
        event.preventDefault()
        this.rtl ? this.next() : this.prev()
        break
      case '[':
        event.preventDefault()
        this.zoomOut()
        break
      case ']':
        event.preventDefault()
        this.zoomIn()
        break
      default: {
        const lower = key.toLowerCase()
        if (lower === 'f') {
          event.preventDefault()
          this.fullscreen()
        } else if (lower === 'r') {
          event.preventDefault()
          this.toggleRtl()
        } else if (lower === 's') {
          event.preventDefault()
          this.toggleSpread()
        } else if (lower === 'd') {
          event.preventDefault()
          this.theme.setSakura(!this.theme.sakura())
        }
      }
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.keyListener)
    clearTimeout(this.progressTimer)
    clearTimeout(this.prefetchTimer)
  }
}


