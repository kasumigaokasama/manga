import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ThemeService } from '../services/theme.service'
import { ApiService } from '../services/api.service'
import { SettingsService } from '../services/settings.service'
import { SoundService } from '../services/sound.service'
import { ToastService } from '../services/toast.service'

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-xl mx-auto card">
      <h1 class="text-lg font-bold mb-2">Einstellungen</h1>
      <div class="space-y-2">
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="theme.sakura()" (ngModelChange)="theme.setSakura($event)" /> Sakura Theme</label>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="theme.blossoms()" (ngModelChange)="theme.setBlossoms($event)" /> Blüten-Animation</label>
        <div class="grid grid-cols-2 gap-2" *ngIf="theme.blossoms()">
          <label class="flex items-center gap-2 col-span-2">Dichte: {{ theme.blossomsDensity() }}
            <input type="range" min="10" max="120" [ngModel]="theme.blossomsDensity()" (ngModelChange)="theme.setBlossomsDensity($event)" />
          </label>
          <label class="flex items-center gap-2 col-span-2">Geschwindigkeit: {{ theme.blossomsSpeed() | number:'1.1-1' }}x
            <input type="range" min="0.5" max="2" step="0.1" [ngModel]="theme.blossomsSpeed()" (ngModelChange)="theme.setBlossomsSpeed($event)" />
          </label>
        </div>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.readerRtl()" (ngModelChange)="settings.setReaderRtl($event)" /> Leserichtung RTL (Manga)</label>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.readerSpread()" (ngModelChange)="settings.setReaderSpread($event)" /> Doppelseite (2-up) standardmäßig</label>
        <div class="grid grid-cols-2 gap-2" *ngIf="!theme.sakura()">
          <label class="flex items-center gap-2 col-span-2">Sternen-Dichte: {{ theme.starDensity() }}
            <input type="range" min="40" max="600" [ngModel]="theme.starDensity()" (ngModelChange)="theme.setStarDensity($event)" />
          </label>
          <label class="flex items-center gap-2 col-span-2"><input type="checkbox" [ngModel]="theme.starfieldEnabled()" (ngModelChange)="theme.setStarfieldEnabled($event)" /> Sternenhimmel aktiv</label>
        </div>
        <div class="flex gap-2 pt-2">
          <button class="border px-3 py-1 rounded" (click)="theme.preset('sakura-day')">Preset: Sakura Day</button>
          <button class="border px-3 py-1 rounded" (click)="theme.preset('sakura-night')">Preset: Sakura Night</button>
          <button class="border px-3 py-1 rounded" (click)="theme.preset('minimal')">Preset: Minimal</button>
          <button class="border px-3 py-1 rounded" (click)="resetAll()">Auf Standard zurücksetzen</button>
        </div>
      </div>
    </div>

    <div class="max-w-xl mx-auto card mt-4">
      <h2 class="font-bold mb-2">Passwort ändern</h2>
      <form class="grid gap-2" (ngSubmit)="submitPassword()">
        <input class="border p-2 rounded" type="password" placeholder="Aktuelles Passwort" [(ngModel)]="currentPassword" name="currentPassword" required />
        <input class="border p-2 rounded" type="password" placeholder="Neues Passwort" [(ngModel)]="newPassword" name="newPassword" required />
        <button class="bg-matcha text-white rounded px-4 py-2">Speichern</button>
      </form>
    </div>

    <div class="max-w-xl mx-auto card mt-4">
      <h2 class="font-bold mb-2">Audio / Feedback</h2>
      <div class="space-y-2">
        <label class="flex items-center gap-2">
          <input type="checkbox" [ngModel]="sound.enabled" (ngModelChange)="sound.setEnabled($event)" />
          Sound aktiv (dezent)
        </label>
        <label class="flex items-center gap-2">Lautstärke: {{ sound.volume | number:'1.0-2' }}
          <input type="range" min="0" max="1" step="0.05" [ngModel]="sound.volume" (ngModelChange)="sound.setVolume($event)" />
        </label>
      </div>
    </div>
  `
})
export class SettingsPage implements OnInit {
  constructor(public theme: ThemeService, private api: ApiService, public settings: SettingsService, public sound: SoundService, private toast: ToastService) {}
  ngOnInit(): void { this.theme.apply() }
  currentPassword = ''
  newPassword = ''
  async submitPassword() {
    try {
      await this.api.changePassword(this.currentPassword, this.newPassword)
      this.currentPassword = ''
      this.newPassword = ''
      this.toast.show('Passwort aktualisiert', 'success')
    } catch { this.toast.show('Fehler beim Ändern des Passworts', 'error') }
  }

  resetAll() {
    // Theme preset to Sakura Day defaults
    this.theme.preset('sakura-day')
    // Reader defaults: RTL on for Manga, spread off
    this.settings.setReaderRtl(true)
    this.settings.setReaderSpread(false)
    // Sound defaults: muted and disabled
    this.sound.setEnabled(false)
    this.sound.setVolume(0)
    this.toast.show('Zurückgesetzt auf Standardwerte', 'info')
  }
}
