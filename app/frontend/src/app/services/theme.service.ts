import { Injectable, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class ThemeService {
  themeName = signal<'sakura' | 'dark' | 'emerald'>((localStorage.getItem('theme') as any) || 'sakura')
  sakura = () => this.themeName() === 'sakura'

  // Default: blossoms on for first visit
  blossoms = signal<boolean>((localStorage.getItem('blossoms') ?? '1') === '1')
  blossomsDensity = signal<number>(Number(localStorage.getItem('blossomsDensity') || '40'))
  blossomsSpeed = signal<number>(Number(localStorage.getItem('blossomsSpeed') || '1'))
  starDensity = signal<number>(Number(localStorage.getItem('starDensity') || '120'))
  starfieldEnabled = signal<boolean>(localStorage.getItem('starfield') !== '0')

  apply() {
    const body = document.body
    body.classList.remove('theme-sakura', 'theme-dark', 'theme-emerald')
    body.classList.add(`theme-${this.themeName()}`)
  }

  setTheme(v: 'sakura' | 'dark' | 'emerald') { this.themeName.set(v); localStorage.setItem('theme', v); this.apply() }
  setSakura(v: boolean) { this.setTheme(v ? 'sakura' : 'dark') }
  setBlossoms(v: boolean) { this.blossoms.set(v); localStorage.setItem('blossoms', v ? '1' : '0') }
  setBlossomsDensity(v: number) { this.blossomsDensity.set(v); localStorage.setItem('blossomsDensity', String(v)) }
  setBlossomsSpeed(v: number) { this.blossomsSpeed.set(v); localStorage.setItem('blossomsSpeed', String(v)) }
  setStarDensity(v: number) { this.starDensity.set(v); localStorage.setItem('starDensity', String(v)) }
  setStarfieldEnabled(v: boolean) { this.starfieldEnabled.set(v); localStorage.setItem('starfield', v ? '1' : '0') }

  // Presets
  preset(dayNight: 'sakura-day' | 'sakura-night' | 'emerald-forest') {
    if (dayNight === 'sakura-day') {
      this.setSakura(true)
      this.setBlossoms(true)
      this.setBlossomsDensity(80)
      this.setBlossomsSpeed(1.2)
      this.setStarfieldEnabled(false)
    } else if (dayNight === 'sakura-night') {
      this.setSakura(false)
      this.setStarfieldEnabled(true)
      this.setStarDensity(200)
      this.setBlossoms(false)
    } else {
      // emerald-forest
      this.setTheme('emerald')
      this.setBlossoms(false)
      this.setStarfieldEnabled(false)
    }
  }
}
