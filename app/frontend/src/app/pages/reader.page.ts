import { Component, ElementRef, OnDestroy, ViewChild, signal, computed, HostListener } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { ApiService, Book } from '../services/api.service'
import { SettingsService } from '../services/settings.service'
import { ThemeService } from '../services/theme.service'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

try {
  GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs?v=revolution'
} catch (e) {
  console.error('Failed to configure PDF worker', e)
}

@Component({
  standalone: true,
  selector: 'app-reader',
  imports: [CommonModule],
  styles: [`
    :host { display: block; height: 100vh; background: #1a1a1a; overflow: hidden; position: relative; font-family: 'Inter', sans-serif; }
    .stage { perspective: 2000px; height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    
    .pages-container {
      display: flex;
      justify-content: center;
      align-items: center;
      transition: transform 0.6s cubic-bezier(0.645, 0.045, 0.355, 1);
      transform-style: preserve-3d;
      gap: 2px;
    }

    .book-page { 
      background: white;
      box-shadow: 0 10px 40px rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      backface-visibility: hidden;
      overflow: hidden;
      height: 92vh;
      max-width: 95vw;
    }
    
    .single-page { width: auto; aspect-ratio: auto; }
    .spread-page { width: 48vw; }

    .controls-overlay {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
      padding: 3rem 2rem 1.5rem;
      transition: opacity 0.4s ease, transform 0.4s ease;
      z-index: 100;
    }
    
    .hud-top {
      position: absolute; top: 0; left: 0; right: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
      padding: 1.5rem 2rem;
      z-index: 100;
      transition: opacity 0.4s ease;
    }

    .btn-icon { 
      @apply p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur border border-white/5 flex items-center justify-center;
      width: 48px; height: 48px;
    }
    .btn-icon.active { @apply bg-sakura/30 border-sakura/50 text-sakura shadow-[0_0_15px_rgba(255,105,180,0.3)]; }
    
    .material-icons { font-size: 24px; }
    
    input[type=range] {
      @apply w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-sakura;
    }
  `],
  template: `
    <div class="stage" (click)="onStageClick($event)">
      <div *ngIf="loading()" class="text-white flex flex-col items-center animate-pulse z-50">
        <span class="material-icons text-5xl mb-3">auto_stories</span>
        <span class="text-lg font-light tracking-widest">LADE MANGA...</span>
      </div>

      <!-- Spread / Single View Container -->
      <div class="pages-container" [style.transform]="pageTransform()" *ngIf="book && !loading()">
        
        <!-- Slot 1 (Links in LTR, Rechts in RTL) -->
        <div class="book-page" [class.spread-page]="isSpreadMode()" [class.single-page]="!isSpreadMode()">
          <canvas #canvas1 class="block h-full w-auto object-contain"></canvas>
          <img *ngIf="currentImageSrc1" [src]="currentImageSrc1" class="block h-full w-auto object-contain" />
        </div>

        <!-- Slot 2 (Rechts in LTR, Links in RTL - Only if spread) -->
        <div class="book-page spread-page" *ngIf="isSpreadMode()">
          <canvas #canvas2 class="block h-full w-auto object-contain"></canvas>
          <img *ngIf="currentImageSrc2" [src]="currentImageSrc2" class="block h-full w-auto object-contain" />
        </div>
      </div>
    </div>

    <!-- HUD Top -->
    <div class="hud-top flex justify-between items-center" [class.opacity-0]="!uiVisible">
      <button (click)="goBack()" class="btn-icon">
        <span class="material-icons">arrow_back</span>
      </button>
      
      <div class="flex items-center gap-3">
        <div class="bg-black/60 backdrop-blur px-4 py-1.5 rounded-full text-white text-sm font-medium tracking-tight border border-white/10">
          {{ pageDisplay() }}
        </div>
        <button class="btn-icon" (click)="toggleSpread()" [class.active]="spread()" title="Zweiseitige Ansicht">
          <span class="material-icons">{{ spread() ? 'auto_stories' : 'description' }}</span>
        </button>
      </div>
    </div>

    <!-- HUD Bottom -->
    <div class="controls-overlay flex flex-col gap-6" [class.opacity-0]="!uiVisible" [class.translate-y-4]="!uiVisible">
      <div class="px-8">
        <input type="range" [min]="1" [max]="totalPages || 1" [value]="page()" (input)="onScrub($event)">
      </div>
      
      <div class="flex justify-center items-center gap-8">
        <button class="btn-icon" (click)="prev()" title="Zurück">
          <span class="material-icons">chevron_left</span>
        </button>
        
        <button class="btn-icon" (click)="toggleFullscreen()" title="Vollbild">
          <span class="material-icons">fullscreen</span>
        </button>
        
        <button class="btn-icon" (click)="toggleRtl()" [class.active]="rtl()" title="Leserichtung (Manga-Modus)">
          <span class="material-icons">swap_horiz</span>
        </button>
        
        <a class="btn-icon" [href]="downloadUrl()" download title="Download"> 
          <span class="material-icons">file_download</span>
        </a>
        
        <button class="btn-icon" (click)="next()" title="Weiter">
          <span class="material-icons">chevron_right</span>
        </button>
      </div>
    </div>
  `
})
export class ReaderPage implements OnDestroy {
  @ViewChild('canvas1') canvas1?: ElementRef<HTMLCanvasElement>
  @ViewChild('canvas2') canvas2?: ElementRef<HTMLCanvasElement>

  id: number | null = null
  page = signal(1)
  loading = signal(true)
  rtl = signal(true)
  spread = signal(true)
  totalPages = 0
  book?: Book

  flipping = signal(false)
  pageTransform = computed(() => this.flipping() ? `rotateY(${this.rtl() ? 90 : -90}deg) scale(0.95)` : 'rotateY(0deg) scale(1)')
  uiVisible = true
  uiTimer: any

  pdfDoc: PDFDocumentProxy | null = null
  currentImageSrc1: string | null = null
  currentImageSrc2: string | null = null

  constructor(
    private route: ActivatedRoute,
    public api: ApiService,
    private settings: SettingsService,
    public theme: ThemeService
  ) {
    this.id = Number(this.route.snapshot.paramMap.get('id'))
    this.rtl.set(this.settings.readerRtl())
    this.loadBook()

    this.resetUiTimer()
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('keydown', this.onKeyDown)
  }

  @HostListener('window:mousemove') onMouseMove = () => this.showUiTemporary()
  @HostListener('window:keydown', ['$event']) onKeyDown = (e: KeyboardEvent) => this.handleKey(e)

  async loadBook() {
    try {
      const { book } = await this.api.getBook(this.id!)
      this.book = book
      this.totalPages = book.pageCount || 0

      const p = await this.api.getProgress(this.id!)
      if (p?.page) this.page.set(p.page)

      if (book.format === 'pdf') {
        const url = `${this.api.base}/api/books/${this.id}/stream`
        const token = this.api.token()
        this.pdfDoc = await getDocument({
          url,
          httpHeaders: token ? { 'Authorization': `Bearer ${token}` } : undefined,
          withCredentials: true
        }).promise
        this.totalPages = this.pdfDoc.numPages
      }

      setTimeout(() => this.render(), 200)
    } catch (e) {
      console.error('Reader init failed', e)
      this.loading.set(false)
    }
  }

  isSpreadMode() {
    if (!this.spread()) return false
    // Erstseite und letzte Seite sind einzeln
    if (this.page() === 1 || this.page() === this.totalPages) return false
    return true
  }

  pageDisplay() {
    if (!this.isSpreadMode()) return `${this.page()} / ${this.totalPages}`
    const p1 = this.page()
    const p2 = Math.min(this.totalPages, p1 + 1)
    return this.rtl() ? `${p2} - ${p1} / ${this.totalPages}` : `${p1} - ${p2} / ${this.totalPages}`
  }

  async render() {
    if (this.pdfDoc) {
      await this.renderPdf()
    } else {
      await this.renderImages()
    }
    this.loading.set(false)
  }

  async renderPdf() {
    if (!this.pdfDoc) return
    const p1 = this.page()

    if (!this.isSpreadMode()) {
      await this.renderPageToCanvas(p1, this.canvas1)
    } else {
      const p2 = p1 + 1
      if (this.rtl()) {
        await this.renderPageToCanvas(p1, this.canvas2) // Aktuelle rechts
        await this.renderPageToCanvas(p2, this.canvas1) // Nächste links
      } else {
        await this.renderPageToCanvas(p1, this.canvas1) // Aktuelle links
        await this.renderPageToCanvas(p2, this.canvas2) // Nächste rechts
      }
    }
  }

  async renderImages() {
    const p1 = this.page()
    this.currentImageSrc1 = this.getPageUrl(p1)
    if (this.isSpreadMode()) {
      this.currentImageSrc2 = this.getPageUrl(p1 + 1)
      if (this.rtl()) {
        const tmp = this.currentImageSrc1
        this.currentImageSrc1 = this.currentImageSrc2
        this.currentImageSrc2 = tmp
      }
    } else {
      this.currentImageSrc2 = null
    }
  }

  async renderPageToCanvas(num: number, ref?: ElementRef<HTMLCanvasElement>) {
    if (!this.pdfDoc || !ref || num < 1 || num > this.totalPages) return
    const canvas = ref.nativeElement
    try {
      const page = await this.pdfDoc.getPage(num)
      const viewport = page.getViewport({ scale: 1.5 })
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (e) { console.error('Render err', e) }
  }

  getPageUrl(n: number) {
    if (!this.book) return ''
    return `${this.api.base}/api/books/${this.id}/pages/${n}?token=${this.api.token()}`
  }

  downloadUrl() {
    if (!this.book) return ''
    return `${this.api.base}/api/books/${this.id}/download?token=${this.api.token()}`
  }

  async next() {
    if (this.page() >= this.totalPages) return
    let step = 1
    if (this.isSpreadMode()) {
      step = 2
    } else if (this.spread() && this.page() === 1) {
      step = 1 // Von Cover zu Spread
    }
    this.doFlip(step)
  }

  async prev() {
    if (this.page() <= 1) return
    let step = 1
    if (this.spread()) {
      if (this.page() === 2) step = 1 // Zurück zu Cover
      else if (this.page() > 2) step = 2
    }
    this.doFlip(-step)
  }

  async doFlip(step: number) {
    this.flipping.set(true)
    setTimeout(async () => {
      const dir = this.rtl() ? -1 : 1
      const target = Math.max(1, Math.min(this.totalPages, this.page() + (step * dir)))
      this.page.set(target)
      await this.render()
      this.api.setProgress(this.id!, this.page(), (this.page() / this.totalPages) * 100).catch(() => { })
      this.flipping.set(false)
    }, 300)
  }

  toggleRtl() { this.rtl.set(!this.rtl()); this.settings.setReaderRtl(this.rtl()); this.render() }
  toggleSpread() { this.spread.set(!this.spread()); this.render() }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  onStageClick(e: MouseEvent) {
    const width = window.innerWidth
    const rightSide = e.clientX > width / 2
    // In RTL: Rechts = Zurück, Links = Weiter
    // In LTR: Rechts = Weiter, Links = Zurück
    if (this.rtl()) {
      if (rightSide) this.prev()
      else this.next()
    } else {
      if (rightSide) this.next()
      else this.prev()
    }
  }

  handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') this.rtl() ? this.prev() : this.next()
    if (e.key === 'ArrowLeft') this.rtl() ? this.next() : this.prev()
    if (e.key === ' ') { this.toggleFullscreen(); e.preventDefault() }
  }

  resetUiTimer() {
    clearTimeout(this.uiTimer)
    this.uiVisible = true
    this.uiTimer = setTimeout(() => this.uiVisible = false, 3000)
  }
  showUiTemporary() { this.resetUiTimer() }
  goBack() { history.back() }

  onScrub(e: Event) {
    const val = Number((e.target as HTMLInputElement).value)
    this.page.set(val)
    this.render()
  }

  ngOnDestroy() {
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('keydown', this.onKeyDown)
  }
}
