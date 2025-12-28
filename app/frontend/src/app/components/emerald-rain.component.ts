import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
  standalone: true,
  selector: 'app-emerald-rain',
  imports: [CommonModule],
  template: `<canvas #c class="fixed inset-0 pointer-events-none" style="z-index:1" *ngIf="enabled"></canvas>`
})
export class EmeraldRainComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() enabled = false
  @Input() density = 40
  @Input() speed = 1
  @ViewChild('c', { static: false }) canvas?: ElementRef<HTMLCanvasElement>
  private raf = 0
  private gems: {
    x: number; y: number;
    size: number;
    alpha: number; hue: number;
    shimmerPhase: number;
    shimmerSpeed: number;
    pulsePhase: number;
    rotation: number;
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

  spawnGem(vw: number, vh: number) {
    const x = Math.random() * vw
    const y = Math.random() * vh
    const size = 2 + Math.random() * 5
    const alpha = 0.3 + Math.random() * 0.5
    const hue = 140 + Math.random() * 40 // emerald green range
    const shimmerPhase = Math.random() * Math.PI * 2
    const shimmerSpeed = 0.01 + Math.random() * 0.02
    const pulsePhase = Math.random() * Math.PI * 2
    const rotation = Math.random() * Math.PI * 2
    return { x, y, size, alpha, hue, shimmerPhase, shimmerSpeed, pulsePhase, rotation }
  }

  ngOnDestroy(): void { this.destroy() }

  private drawGem(ctx: CanvasRenderingContext2D, gem: {
    x: number; y: number; size: number; alpha: number; hue: number;
    shimmerPhase: number; rotation: number; pulsePhase: number;
  }) {
    const shimmerIntensity = Math.sin(gem.shimmerPhase) * 0.5 + 0.5
    const pulseSize = Math.sin(gem.pulsePhase) * 0.3 + 1

    ctx.save()
    ctx.translate(gem.x, gem.y)
    ctx.rotate(gem.rotation)

    const effectiveSize = gem.size * pulseSize

    // Outer glow
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, effectiveSize * 3)
    glowGradient.addColorStop(0, `hsla(${gem.hue}, 80%, 60%, ${gem.alpha * shimmerIntensity * 0.4})`)
    glowGradient.addColorStop(0.5, `hsla(${gem.hue}, 70%, 50%, ${gem.alpha * shimmerIntensity * 0.2})`)
    glowGradient.addColorStop(1, `hsla(${gem.hue}, 60%, 40%, 0)`)
    ctx.fillStyle = glowGradient
    ctx.beginPath()
    ctx.arc(0, 0, effectiveSize * 3, 0, Math.PI * 2)
    ctx.fill()

    // Main gem body (hexagon shape)
    ctx.fillStyle = `hsla(${gem.hue}, 90%, 45%, ${gem.alpha})`
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i
      const x = Math.cos(angle) * effectiveSize
      const y = Math.sin(angle) * effectiveSize
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()

    // Inner highlight with shimmer
    const highlightIntensity = shimmerIntensity * 0.8 + 0.2
    ctx.fillStyle = `hsla(${gem.hue + 20}, 100%, 75%, ${gem.alpha * highlightIntensity})`
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i
      const x = Math.cos(angle) * effectiveSize * 0.5
      const y = Math.sin(angle) * effectiveSize * 0.5
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()

    // Bright sparkle point
    if (shimmerIntensity > 0.7) {
      ctx.fillStyle = `hsla(${gem.hue + 30}, 100%, 95%, ${(shimmerIntensity - 0.7) * 3 * gem.alpha})`
      ctx.beginPath()
      ctx.arc(-effectiveSize * 0.3, -effectiveSize * 0.3, effectiveSize * 0.3, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
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

      // Respawn gems when resizing
      const vw = w
      const vh = h
      const n = Math.max(20, Math.min(300, Math.floor(this.density)))
      this.gems = Array.from({ length: n }, () => this.spawnGem(vw, vh))
    }
    resize()
    window.addEventListener('resize', resize)
    this.resizeHandler = resize

    const loop = () => {
      if (!this.ctx) return
      ctx.clearRect(0, 0, c.width, c.height)

      for (const gem of this.gems) {
        // Update shimmer and pulse phases
        gem.shimmerPhase += gem.shimmerSpeed * this.speed
        gem.pulsePhase += 0.008 * this.speed

        this.drawGem(ctx, gem)
      }

      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resizeHandler)
    this.ctx = undefined
    this.gems = []
  }
}
