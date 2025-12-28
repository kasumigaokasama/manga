import { Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core'
import { I18nService } from '../services/i18n.service'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, Router } from '@angular/router'
import { ChapterService, ChapterRef } from '../services/chapter.service'
import { ReaderToolbarComponent } from './reader-toolbar.component'
import { ThumbnailStripComponent } from './thumbnail-strip.component'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

@Component({
  standalone: true,
  selector: 'app-manga-reader',
  imports: [CommonModule, ReaderToolbarComponent, ThumbnailStripComponent],
  templateUrl: './manga-reader.component.html',
  styleUrls: ['./manga-reader.component.css']
})
export class MangaReaderComponent implements OnDestroy {
  @ViewChild('canvasLeft') canvasLeft?: ElementRef<HTMLCanvasElement>
  @ViewChild('canvasRight') canvasRight?: ElementRef<HTMLCanvasElement>

  ref!: ChapterRef
  pdfDoc: PDFDocumentProxy | null = null

  page = signal(1)
  total = signal(0)
  spread = signal(true)
  rtl = signal(true)
  zoomMode = signal<'fit-width' | 'fit-page' | 'percent'>('fit-width')
  zoomPercent = signal(100)

  private prefetching = new Set<number>()
  private destroyed = false

  constructor(private route: ActivatedRoute, private router: Router, private chapters: ChapterService, public i18n: I18nService) {
    try { (GlobalWorkerOptions as any).workerSrc = '/assets/pdf.worker.min.mjs?v=revolution' } catch { }
    const slug = this.route.snapshot.paramMap.get('slug') || 'one-piece'
    const chapter = this.route.snapshot.paramMap.get('chapter') || '001'
    this.ref = this.chapters.getChapter(slug, chapter)
    this.page.set(this.chapters.loadProgress(this.ref))
    this.loadPdf().catch(() => this.router.navigateByUrl('/not-found'))
    window.addEventListener('keydown', this.onKey)
  }

  async loadPdf() {
    this.pdfDoc = await getDocument({ url: this.ref.url }).promise
    this.total.set(this.pdfDoc.numPages)
    this.page.set(Math.min(this.total(), Math.max(1, this.page())))
    await this.render()
    this.prefetchAround()
  }

  private viewportFor(page: any, canvas: HTMLCanvasElement) {
    const dpr = (window.devicePixelRatio || 1)
    let scale = 1
    if (this.zoomMode() === 'percent') {
      scale = this.zoomPercent() / 100
    } else {
      const vw = canvas.clientWidth || canvas.parentElement?.clientWidth || 800
      const vh = canvas.clientHeight || canvas.parentElement?.clientHeight || 1200
      const vp = page.getViewport({ scale: 1 })
      const scaleW = vw / vp.width
      const scaleH = vh / vp.height
      scale = this.zoomMode() === 'fit-width' ? scaleW : Math.min(scaleW, scaleH)
    }
    return page.getViewport({ scale: scale * dpr })
  }

  private async render() {
    if (!this.pdfDoc) return
    const current = this.page()
    const leftCanvas = this.canvasLeft?.nativeElement
    const rightCanvas = this.canvasRight?.nativeElement

    const indices = this.spread()
      ? this.rtl() ? [current, Math.min(this.total(), current - 1)] : [current, Math.min(this.total(), current + 1)]
      : [current]

    const p1 = await this.pdfDoc.getPage(indices[0])
    if (leftCanvas) await this.renderPageToCanvas(p1, leftCanvas)

    if (this.spread() && indices[1] && rightCanvas && indices[1] !== indices[0]) {
      const p2 = await this.pdfDoc.getPage(indices[1])
      await this.renderPageToCanvas(p2, rightCanvas)
    } else if (rightCanvas) {
      const ctx = rightCanvas.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, rightCanvas.width, rightCanvas.height); rightCanvas.width = 0; rightCanvas.height = 0; }
    }

    this.chapters.saveProgress(this.ref, current)
  }

  private async renderPageToCanvas(page: any, canvas: HTMLCanvasElement) {
    const vp = this.viewportFor(page, canvas)
    canvas.width = Math.floor(vp.width)
    canvas.height = Math.floor(vp.height)
    canvas.style.width = Math.floor(vp.width / (window.devicePixelRatio || 1)) + 'px'
    canvas.style.height = Math.floor(vp.height / (window.devicePixelRatio || 1)) + 'px'
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport: vp }).promise
  }

  next() { const d = this.rtl() ? -1 : 1; this.setPage(this.page() + (this.spread() ? 2 * d : d)) }
  prev() { const d = this.rtl() ? 1 : -1; this.setPage(this.page() + (this.spread() ? 2 * d : d)) }

  setPage(n: number) {
    if (!this.pdfDoc) return
    const clamped = Math.max(1, Math.min(this.total(), Math.floor(n)))
    this.page.set(clamped)
    this.render()
    this.prefetchAround()
  }

  toggleSpread() { this.spread.set(!this.spread()); this.render() }
  toggleRtl() { this.rtl.set(!this.rtl()); this.render() }
  zoomIn() { this.zoomMode.set('percent'); this.zoomPercent.set(Math.min(300, this.zoomPercent() + 10)); this.render() }
  zoomOut() { this.zoomMode.set('percent'); this.zoomPercent.set(Math.max(50, this.zoomPercent() - 10)); this.render() }
  fitWidth() { this.zoomMode.set('fit-width'); this.render() }
  fitPage() { this.zoomMode.set('fit-page'); this.render() }

  onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'arrowright') { e.preventDefault(); this.rtl() ? this.prev() : this.next() }
    else if (k === 'arrowleft') { e.preventDefault(); this.rtl() ? this.next() : this.prev() }
    else if (k === 'j') { e.preventDefault(); this.next() }
    else if (k === 'k') { e.preventDefault(); this.prev() }
    else if (k === '[') { e.preventDefault(); this.zoomOut() }
    else if (k === ']') { e.preventDefault(); this.zoomIn() }
    else if (k === 'r') { e.preventDefault(); this.toggleRtl() }
    else if (k === 's') { e.preventDefault(); this.toggleSpread() }
    else if (k === 'f') { e.preventDefault(); this.fitWidth() }
    else if (k === 'p') { e.preventDefault(); this.fitPage() }
  }

  prefetchAround() {
    if (!this.pdfDoc) return
    const base = this.page()
    const d = this.rtl() ? -1 : 1
    const candidates = [base + d, base + 2 * d]
    for (const n of candidates) {
      if (n < 1 || n > this.total()) continue
      if (this.prefetching.has(n)) continue
      this.prefetching.add(n)
      this.pdfDoc.getPage(n).then(p => p.getOperatorList?.()).finally(() => this.prefetching.delete(n))
      if (this.destroyed) break
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true
    window.removeEventListener('keydown', this.onKey)
  }

  getPagesArray(n: number) {
    const arr: number[] = []
    for (let i = 1; i <= n; i++) arr.push(i)
    return arr
  }
}

