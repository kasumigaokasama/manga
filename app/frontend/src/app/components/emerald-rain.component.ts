import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
  standalone: true,
  selector: 'app-emerald-rain',
  imports: [CommonModule],
  template: `<canvas #c class="fixed inset-0 pointer-events-none" style="z-index:3" *ngIf="enabled"></canvas>`
})
export class EmeraldRainComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() enabled = false
  @Input() density = 40
  @Input() speed = 1
  @ViewChild('c', { static: false }) canvas?: ElementRef<HTMLCanvasElement>
  private raf = 0
  private crystals: {
    x: number; y: number; vy: number;
    rot: number; rotv: number;
    t: number; tVel: number; amp: number;
    size: number;
    alpha: number; hue: number;
    shimmer: number;
  }[] = []
  private resizeHandler = () => {}
  private ctx?: CanvasRenderingContext2D
  private dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))

  ngAfterViewInit(): void { this.initIfNeeded() }

  ngOnChanges(changes: SimpleChanges): void {
    if ('enabled' in changes) {
      if (!this.enabled) {
        this.destroy()
      } else {
        queueMicrotask(() => this.initIfNeeded(true))
      }
    }
    if ((changes['density'] || changes['speed']) && this.enabled) {
        queueMicrotask(() => this.initIfNeeded(true))
    }
  }

  spawn(c: HTMLCanvasElement) {
    const vw = c.width / this.dpr
    const x = Math.random() * vw
    const y = -10 - Math.random() * 60
    const vy = 0.5 + Math.random() * 1.5
    const rot = Math.random() * Math.PI * 2
    const rotv = (Math.random() - 0.5) * 0.02
    const t = Math.random() * Math.PI * 2
    const tVel = 0.008 + Math.random() * 0.015
    const amp = 0.3 + Math.random() * 0.8
    const size = 3 + Math.random() * 4
    const alpha = 0.6 + Math.random() * 0.4
    const hue = 150 + Math.random() * 30 // emerald green range
    const shimmer = Math.random() * Math.PI * 2
    return { x, y, vy, rot, rotv, t, tVel, amp, size, alpha, hue, shimmer }
  }

  ngOnDestroy(): void { this.destroy() }

  private drawCrystal(ctx: CanvasRenderingContext2D, size: number, hue: number, alpha: number, shimmer: number) {
    // Draw a diamond/crystal shape
    const shimmerAlpha = 0.3 + Math.sin(shimmer) * 0.2

    // Outer glow
    ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${alpha * 0.3})`
    ctx.beginPath()
    ctx.moveTo(0, -size * 1.4)
    ctx.lineTo(size * 0.8, 0)
    ctx.lineTo(0, size * 1.4)
    ctx.lineTo(-size * 0.8, 0)
    ctx.closePath()
    ctx.fill()

    // Main crystal
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${alpha})`
    ctx.beginPath()
    ctx.moveTo(0, -size)
    ctx.lineTo(size * 0.6, 0)
    ctx.lineTo(0, size)
    ctx.lineTo(-size * 0.6, 0)
    ctx.closePath()
    ctx.fill()

    // Highlight
    ctx.fillStyle = `hsla(${hue + 10}, 100%, 85%, ${alpha * shimmerAlpha})`
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.7)
    ctx.lineTo(size * 0.3, -size * 0.2)
    ctx.lineTo(0, size * 0.3)
    ctx.lineTo(-size * 0.3, -size * 0.2)
    ctx.closePath()
    ctx.fill()
  }

  private initIfNeeded(reinit = false) {
    if (!this.enabled || !this.canvas) return
    if (reinit) this.destroy()
    const c = this.canvas.nativeElement
    const ctx = c.getContext('2d')!
    this.ctx = ctx
    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      c.width = Math.floor(w * this.dpr)
      c.height = Math.floor(h * this.dpr)
      c.style.width = w + 'px'
      c.style.height = h + 'px'
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    }
    resize(); window.addEventListener('resize', resize)
    this.resizeHandler = resize
    const n = Math.max(12, Math.min(220, Math.floor(this.density)))
    this.crystals = Array.from({ length: n }, () => this.spawn(c))
    const loop = () => {
      if (!this.ctx) return
      ctx.clearRect(0, 0, c.width, c.height)
      for (const p of this.crystals) {
        p.t += p.tVel * this.speed
        const wind = Math.sin(p.t) * p.amp
        const jitter = (Math.random() - 0.5) * 0.1 * this.speed
        p.vy += 0.001 * this.speed
        p.x += wind + jitter
        p.y += p.vy
        p.rot += p.rotv * this.speed
        p.shimmer += 0.05 * this.speed

        const vw = c.width / this.dpr
        const vh = c.height / this.dpr
        if (p.y > vh + 30 || p.x < -40 || p.x > vw + 40) Object.assign(p, this.spawn(c))

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        this.drawCrystal(ctx, p.size, p.hue, p.alpha, p.shimmer)
        ctx.restore()
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resizeHandler)
    this.ctx = undefined
    this.crystals = []
  }
}
