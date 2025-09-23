import { Injectable, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class ThemeService {
  sakura = signal<boolean>(localStorage.getItem('theme') !== 'dark')
  blossoms = signal<boolean>(localStorage.getItem('blossoms') === '1')
  blossomsDensity = signal<number>(Number(localStorage.getItem('blossomsDensity') || '40'))
  blossomsSpeed = signal<number>(Number(localStorage.getItem('blossomsSpeed') || '1'))
  starDensity = signal<number>(Number(localStorage.getItem('starDensity') || '120'))
  starfieldEnabled = signal<boolean>(localStorage.getItem('starfield') !== '0')

  apply() {
    const body = document.body
    if (this.sakura()) {
      body.classList.add('theme-sakura')
      body.classList.remove('theme-dark')
    } else {
      body.classList.remove('theme-sakura')
      body.classList.add('theme-dark')
    }
  }

  setSakura(v: boolean) { this.sakura.set(v); localStorage.setItem('theme', v ? 'sakura' : 'dark'); this.apply() }
  setBlossoms(v: boolean) { this.blossoms.set(v); localStorage.setItem('blossoms', v ? '1' : '0') }
  setBlossomsDensity(v: number) { this.blossomsDensity.set(v); localStorage.setItem('blossomsDensity', String(v)) }
  setBlossomsSpeed(v: number) { this.blossomsSpeed.set(v); localStorage.setItem('blossomsSpeed', String(v)) }
  setStarDensity(v: number) { this.starDensity.set(v); localStorage.setItem('starDensity', String(v)) }
  setStarfieldEnabled(v: boolean) { this.starfieldEnabled.set(v); localStorage.setItem('starfield', v ? '1' : '0') }

  // Presets
  preset(dayNight: 'sakura-day' | 'sakura-night' | 'minimal') {
    if (dayNight === 'sakura-day') {
      this.setSakura(true)
      this.setBlossoms(true)
      this.setBlossomsDensity(40)
      this.setBlossomsSpeed(1)
      this.setStarfieldEnabled(false)
    } else if (dayNight === 'sakura-night') {
      this.setSakura(false)
      this.setStarfieldEnabled(true)
      this.setStarDensity(200)
      this.setBlossoms(false)
    } else {
      // minimal
      this.setSakura(true)
      this.setBlossoms(false)
      this.setStarfieldEnabled(false)
    }
  }
}
