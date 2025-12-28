import { Injectable, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class ThemeService {
  themeName = signal<'sakura' | 'dark' | 'emerald'>((localStorage.getItem('theme') as any) || 'sakura')
  sakura = () => this.themeName() === 'sakura'
  emerald = () => this.themeName() === 'emerald'
  dark = () => this.themeName() === 'dark'

  // Blossoms (Sakura theme)
  blossoms = signal<boolean>((localStorage.getItem('blossoms') ?? '1') === '1')
  blossomsDensity = signal<number>(Number(localStorage.getItem('blossomsDensity') || '40'))
  blossomsSpeed = signal<number>(Number(localStorage.getItem('blossomsSpeed') || '1'))

  // Emerald rain (Emerald theme)
  emeraldRain = signal<boolean>((localStorage.getItem('emeraldRain') ?? '1') === '1')
  emeraldRainDensity = signal<number>(Number(localStorage.getItem('emeraldRainDensity') || '60'))
  emeraldRainSpeed = signal<number>(Number(localStorage.getItem('emeraldRainSpeed') || '1'))

  // Stars (Dark theme)
  starDensity = signal<number>(Number(localStorage.getItem('starDensity') || '120'))
  starfieldEnabled = signal<boolean>(localStorage.getItem('starfield') !== '0')

  apply() {
    const body = document.body
    body.classList.remove('theme-sakura', 'theme-dark', 'theme-emerald')
    body.classList.add(`theme-${this.themeName()}`)
  }

  setTheme(v: 'sakura' | 'dark' | 'emerald') { this.themeName.set(v); localStorage.setItem('theme', v); this.apply() }
  setSakura(v: boolean) { this.setTheme(v ? 'sakura' : 'dark') }

  // Blossoms setters
  setBlossoms(v: boolean) { this.blossoms.set(v); localStorage.setItem('blossoms', v ? '1' : '0') }
  setBlossomsDensity(v: number) { this.blossomsDensity.set(v); localStorage.setItem('blossomsDensity', String(v)) }
  setBlossomsSpeed(v: number) { this.blossomsSpeed.set(v); localStorage.setItem('blossomsSpeed', String(v)) }

  // Emerald rain setters
  setEmeraldRain(v: boolean) { this.emeraldRain.set(v); localStorage.setItem('emeraldRain', v ? '1' : '0') }
  setEmeraldRainDensity(v: number) { this.emeraldRainDensity.set(v); localStorage.setItem('emeraldRainDensity', String(v)) }
  setEmeraldRainSpeed(v: number) { this.emeraldRainSpeed.set(v); localStorage.setItem('emeraldRainSpeed', String(v)) }

  // Star setters
  setStarDensity(v: number) { this.starDensity.set(v); localStorage.setItem('starDensity', String(v)) }
  setStarfieldEnabled(v: boolean) { this.starfieldEnabled.set(v); localStorage.setItem('starfield', v ? '1' : '0') }

  // Presets
  preset(dayNight: 'sakura' | 'night' | 'emerald-forest') {
    if (dayNight === 'sakura') {
      this.setTheme('sakura')
      this.setBlossoms(true)
      this.setBlossomsDensity(80)
      this.setBlossomsSpeed(1.2)
      this.setStarfieldEnabled(false)
      this.setEmeraldRain(false)
    } else if (dayNight === 'night') {
      this.setTheme('dark')
      this.setStarfieldEnabled(true)
      this.setStarDensity(200)
      this.setBlossoms(false)
      this.setEmeraldRain(false)
    } else {
      // emerald-forest
      this.setTheme('emerald')
      this.setEmeraldRain(true)
      this.setEmeraldRainDensity(60)
      this.setEmeraldRainSpeed(1)
      this.setBlossoms(false)
      this.setStarfieldEnabled(false)
    }
  }
}
