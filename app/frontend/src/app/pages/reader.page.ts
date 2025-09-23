import { Component, effect, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { ApiService } from '../services/api.service'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
// @ts-expect-error - worker entry
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs'

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker

@Component({
  standalone: true,
  selector: 'app-reader',
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-between mb-2">
      <div class="font-semibold">Reader <span class="text-sm text-gray-500" *ngIf="totalPages">(Seite {{ page() }} / {{ totalPages }})</span></div>
      <div class="space-x-2 text-sm">
        <button aria-label="toggle direction" class="px-2 py-1 bg-gray-200 rounded" (click)="toggleRtl()">Richtung: {{ rtl ? 'RTL' : 'LTR' }}</button>
        <button aria-label="toggle spread" class="px-2 py-1 bg-gray-200 rounded" (click)="toggleSpread()">Spread: {{ spread ? '2-up' : '1-up' }}</button>
        <button aria-label="zoom out" class="px-2 py-1 bg-gray-200 rounded" (click)="zoomOut()">-</button>
        <button aria-label="zoom in" class="px-2 py-1 bg-gray-200 rounded" (click)="zoomIn()">+</button>
        <button aria-label="fullscreen" class="px-2 py-1 bg-gray-200 rounded" (click)="fullscreen()">FS</button>
        <button aria-label="prev" class="px-2 py-1 bg-gray-200 rounded" (click)="prev()">←</button>
        <button aria-label="next" class="px-2 py-1 bg-gray-200 rounded" (click)="next()">→</button>
      </div>
    </div>
    <div *ngIf="totalPages" class="mb-3">
      <input type="range" [min]="1" [max]="totalPages!" [value]="page()" (input)="onScrub($event)" class="w-full" />
    </div>
    <div *ngIf="format==='pdf'" (pointerdown)="onPointerDown($event)" (pointerup)="onPointerUp($event)">
      <canvas #pdfCanvas class="mx-auto block"></canvas>
    </div>
    <div *ngIf="format!=='pdf'" class="flex gap-2 justify-center items-start" [style.direction]="rtl ? 'rtl' : 'ltr'" (pointerdown)="onPointerDown($event)" (pointerup)="onPointerUp($event)">
      <img class="max-w-full" [style.transform]="'scale(' + zoom + ')'" [src]="pageSrc(page())" alt="page" />
      <img *ngIf="spread" class="max-w-full" [style.transform]="'scale(' + zoom + ')'" [src]="pageSrc(nextIndexForSpread())" alt="page2" />
    </div>

    <div *ngIf="format!=='pdf' && totalPages" class="mt-3 overflow-x-auto whitespace-nowrap py-2 border-t">
      <button *ngFor="let n of thumbPages()" class="inline-block mr-2 border rounded overflow-hidden focus:outline-none focus:ring"
              (click)="jump(n)" [class.ring-2]="n===page()">
        <img [src]="pageSrc(n)" alt="thumb" width="80" height="120" loading="lazy" />
        <div class="text-center text-xs text-gray-600">{{ n }}</div>
      </button>
    </div>
  `
})
export class ReaderPage {
  id = 0
  page = signal(1)
  zoom = 1
  rtl = true
  spread = false
  format: 'pdf' | 'images' | 'cbz' | 'epub' = 'images'
  private pdfDoc: any
  totalPages: number | null = null

  constructor(private route: ActivatedRoute, public api: ApiService) {
    this.id = Number(this.route.snapshot.paramMap.get('id'))
    // Set defaults from localStorage
    try {
      const rtl = localStorage.getItem('readerRtl'); if (rtl !== null) this.rtl = rtl !== 'false'
      const sp = localStorage.getItem('readerSpread'); if (sp !== null) this.spread = sp === 'true'
    } catch {}
    // Fetch book to determine format and optionally load PDF
    this.api.getBook(this.id).then(async (b) => {
      this.format = b.format as any
      if (b && (b as any).pageCount) this.totalPages = (b as any).pageCount
      if (this.format === 'pdf') await this.loadPdf()
    }).catch(() => {})
    // Load progress
    this.loadProgress()
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.rtl ? this.prev() : this.next()
      if (e.key === 'ArrowLeft') this.rtl ? this.next() : this.prev()
      if (e.key === '+') this.zoomIn()
      if (e.key === '-') this.zoomOut()
      if (e.key.toLowerCase() === 'f') this.fullscreen()
      if (e.key.toLowerCase() === 'r') this.toggleRtl()
      if (e.key.toLowerCase() === 's') this.toggleSpread()
    })
  }

  async loadProgress() {
    try {
      const r = await fetch(`${this.api.base}/api/books/${this.id}/progress`, { headers: { 'Authorization': `Bearer ${this.api.token()}` } })
      if (r.ok) {
        const data = await r.json()
        if (data.progress?.page) this.page.set(data.progress.page)
      }
    } catch {}
  }

  pageSrc(n: number) { return `${this.api.base}/api/books/${this.id}/pages/${n}` }
  nextIndexForSpread() { return this.page() + (this.rtl ? -1 : 1) }
  next() { this.page.update(v => Math.max(1, v + (this.rtl ? -1 : 1))); this.syncProgress(); if (this.format==='pdf') this.renderPdf() }
  prev() { this.page.update(v => Math.max(1, v + (this.rtl ? 1 : -1))); this.syncProgress(); if (this.format==='pdf') this.renderPdf() }
  zoomIn() { this.zoom = Math.min(3, this.zoom + 0.1) }
  zoomOut() { this.zoom = Math.max(0.5, this.zoom - 0.1) }
  toggleRtl() { this.rtl = !this.rtl }
  toggleSpread() { this.spread = !this.spread }
  fullscreen() { document.documentElement.requestFullscreen?.() }

  private syncProgressTimer?: any
  syncProgress() {
    clearTimeout(this.syncProgressTimer)
    this.syncProgressTimer = setTimeout(async () => {
      const body = { page: this.page(), percent: 0 }
      await fetch(`${this.api.base}/api/books/${this.id}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.api.token()}` }, body: JSON.stringify(body) })
    }, 400)
  }

  onScrub(e: any) {
    const n = Number((e.target as HTMLInputElement).value)
    if (!isNaN(n)) { this.page.set(n); this.syncProgress(); if (this.format==='pdf') this.renderPdf(); else this.prefetchImages() }
  }

  // ---- PDF.js helpers ----
  async loadPdf() {
    const url = `${this.api.base}/api/books/${this.id}/stream`
    this.pdfDoc = await (pdfjsLib as any).getDocument(url).promise
    try { this.totalPages = this.pdfDoc.numPages } catch {}
    await this.renderPdf()
  }

  async renderPdf() {
    if (!this.pdfDoc) return
    const c: HTMLCanvasElement | null = document.querySelector('canvas')
    if (!c) return
    const pageNum = Math.max(1, Math.min(this.pdfDoc.numPages, this.page()))
    const page = await this.pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: this.zoom })
    const ctx = c.getContext('2d')!
    c.width = viewport.width
    c.height = viewport.height
    const renderContext = { canvasContext: ctx, viewport }
    await page.render(renderContext).promise
  }

  // ---- Gestures ----
  private startX = 0
  onPointerDown(ev: PointerEvent) { this.startX = ev.clientX }
  onPointerUp(ev: PointerEvent) {
    const dx = ev.clientX - this.startX
    if (Math.abs(dx) > 40) {
      if (dx > 0) { this.rtl ? this.next() : this.prev() } else { this.rtl ? this.prev() : this.next() }
    }
    this.startX = 0
  }

  // Prefetch adjacent images for smoother reading (non-PDF)
  private prefetchTimer?: any
  private prefetchImages() {
    if (this.format === 'pdf') return
    clearTimeout(this.prefetchTimer)
    const curr = this.page()
    const delta = this.rtl ? -1 : 1
    const urls = [this.pageSrc(curr + delta), this.pageSrc(curr + 2 * delta)]
    this.prefetchTimer = setTimeout(() => {
      urls.forEach(u => { const img = new Image(); img.src = u })
    }, 200)
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

  jump(n: number) { this.page.set(n); this.syncProgress(); if (this.format==='pdf') this.renderPdf(); else this.prefetchImages() }
}
