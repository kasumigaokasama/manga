import { Component, ElementRef, ViewChild } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-petal-burst',
  styles: [`
    :host { position: fixed; inset: 0; pointer-events: none; z-index: 50; }
    .p { position: absolute; will-change: transform, opacity; font-size: 18px; }
    @keyframes floatUp { 0% { transform: translate(var(--x,0), var(--y,0)) scale(1); opacity: 1; }
                         100% { transform: translate(calc(var(--x,0) + var(--dx,0px)), calc(var(--y,0) - 140px)) rotate(20deg) scale(1.1); opacity: 0; } }
  `],
  template: `<div #layer></div>`
})
export class PetalBurstComponent {
  @ViewChild('layer', { static: true }) layer!: ElementRef<HTMLDivElement>

  trigger(count = 20, at?: { x: number; y: number }) {
    const rect = this.layer.nativeElement.getBoundingClientRect()
    const cx = at?.x ?? rect.width / 2
    const cy = at?.y ?? rect.height / 2
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span')
      span.textContent = ['🌸','💮','🌺'][Math.floor(Math.random()*3)]
      span.className = 'p'
      const dx = (Math.random() - 0.5) * 200
      const x = cx + (Math.random() - 0.5) * 40
      const y = cy + (Math.random() - 0.5) * 20
      span.style.left = `${x}px`
      span.style.top = `${y}px`
      span.style.setProperty('--x', '0px')
      span.style.setProperty('--y', '0px')
      span.style.setProperty('--dx', `${dx}px`)
      span.style.animation = `floatUp ${800 + Math.random()*400}ms ease-out forwards`
      this.layer.nativeElement.appendChild(span)
      setTimeout(() => span.remove(), 1200)
    }
  }
}

