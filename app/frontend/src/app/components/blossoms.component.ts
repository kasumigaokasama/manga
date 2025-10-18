import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
  standalone: true,
  selector: 'app-blossoms',
  imports: [CommonModule],
  template: `<canvas #c class="fixed inset-0 pointer-events-none" style="z-index:3" *ngIf="enabled"></canvas>`
})
export class BlossomsComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() enabled = false
  @Input() density = 40
  @Input() speed = 1
  @ViewChild('c', { static: false }) canvas?: ElementRef<HTMLCanvasElement>
  private raf = 0
  private petals: {
    x: number; y: number; vy: number;
    rot: number; rotv: number;
    t: number; tVel: number; amp: number;
    sx: number; sy: number;
    alpha: number; hue: number;
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
        // Defer init to next tick so the canvas created by *ngIf exists
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
    const vy = 0.4 + Math.random() * 1.2
    const rot = Math.random() * Math.PI * 2
    const rotv = (Math.random() - 0.5) * 0.015
    const t = Math.random() * Math.PI * 2
    const tVel = 0.012 + Math.random() * 0.022
    const amp = 0.4 + Math.random() * 1.2
    const sx = 4 + Math.random() * 3
    const sy = 2 + Math.random() * 3
    const alpha = 0.75 + Math.random() * 0.25
    const hue = 330 + Math.random() * 20
    return { x, y, vy, rot, rotv, t, tVel, amp, sx, sy, alpha, hue }
  }
  ngOnDestroy(): void { this.destroy() }

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
    this.petals = Array.from({ length: n }, () => this.spawn(c))
    const loop = () => {
      if (!this.ctx) return
      ctx.clearRect(0, 0, c.width, c.height)
      for (const p of this.petals) {
        // horizontal sway via per-petal phase; gravity; small jitter
        p.t += p.tVel * this.speed
        const wind = Math.sin(p.t) * p.amp
        const jitter = (Math.random() - 0.5) * 0.12 * this.speed
        p.vy += 0.0009 * this.speed
        p.x += wind + jitter
        p.y += p.vy
        p.rot += p.rotv * this.speed

        const vw = c.width / this.dpr
        const vh = c.height / this.dpr
        if (p.y > vh + 30 || p.x < -40 || p.x > vw + 40) Object.assign(p, this.spawn(c))

        ctx.save()
        // ctx is already scaled by dpr via setTransform; use logical coords
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = `hsla(${p.hue},70%,90%,${p.alpha})`
        ctx.beginPath(); ctx.ellipse(0, 0, p.sx, p.sy, 0, 0, Math.PI * 2); ctx.fill()
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
    this.petals = []
  }
}

