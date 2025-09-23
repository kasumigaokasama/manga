import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-starfield',
  template: `<canvas #c class="fixed inset-0 pointer-events-none"></canvas>`
})
export class StarfieldComponent implements AfterViewInit, OnDestroy {
  @Input() enabled = true
  @Input() density = 120
  @ViewChild('c', { static: false }) canvas?: ElementRef<HTMLCanvasElement>
  private raf = 0
  private stars: { x: number; y: number; r: number; tw: number }[] = []
  private resize = () => {}

  ngAfterViewInit(): void {
    if (!this.enabled) return
    const c = this.canvas!.nativeElement
    const ctx = c.getContext('2d')!
    const onResize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    onResize(); window.addEventListener('resize', onResize); this.resize = onResize
    const n = Math.max(40, Math.min(600, this.density))
    this.stars = Array.from({ length: n }).map(() => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.2 + 0.3, tw: Math.random() * Math.PI * 2 }))
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const s of this.stars) {
        s.tw += 0.02
        const a = 0.6 + Math.sin(s.tw) * 0.4
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  ngOnDestroy(): void { cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.resize) }
}
