import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-blossoms',
  template: `<canvas #c class="fixed inset-0 pointer-events-none" *ngIf="enabled"></canvas>`
})
export class BlossomsComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() enabled = false
  @Input() density = 40
  @Input() speed = 1
  @ViewChild('c', { static: false }) canvas?: ElementRef<HTMLCanvasElement>
  private raf = 0
  private petals: { x: number; y: number; vx: number; vy: number; r: number; rot: number; rotv: number }[] = []
  private resizeHandler = () => {}

  ngAfterViewInit(): void {
    if (!this.enabled) return
    const c = this.canvas!.nativeElement
    const ctx = c.getContext('2d')!
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    this.resizeHandler = resize
    // seed
    const n = Math.max(5, Math.min(200, this.density))
    this.petals = []
    for (let i = 0; i < n; i++) this.petals.push(this.spawn(c))
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const p of this.petals) {
        p.x += p.vx * this.speed; p.y += p.vy * this.speed; p.vx += 0.005 * this.speed; p.rot += p.rotv * this.speed
        if (p.y > c.height + 20 || p.x > c.width + 20) Object.assign(p, this.spawn(c))
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = 'rgba(249,213,229,0.9)'
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 4, p.r, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['density'] || changes['speed']) {
      // Re-init animation to reflect new density/speed
      cancelAnimationFrame(this.raf)
      if (this.canvas) {
        this.ngAfterViewInit()
      }
    }
  }

  spawn(c: HTMLCanvasElement) {
    return { x: Math.random() * c.width, y: -10, vx: -0.3 + Math.random() * 0.2, vy: 0.8 + Math.random() * 1.4, r: Math.random() * Math.PI, rot: Math.random() * Math.PI, rotv: (Math.random() - 0.5) * 0.02 }
  }
  ngOnDestroy(): void { cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.resizeHandler) }
}
