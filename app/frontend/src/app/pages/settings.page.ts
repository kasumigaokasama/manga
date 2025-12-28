import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ThemeService } from '../services/theme.service'
import { ApiService } from '../services/api.service'
import { SettingsService } from '../services/settings.service'
import { SoundService } from '../services/sound.service'
import { ToastService } from '../services/toast.service'
import { HapticsService } from '../services/haptics.service'
import { I18nService } from '../services/i18n.service'

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-xl mx-auto card">
      <div class="mb-3 p-2 rounded text-sm" [ngClass]="api.authMode()==='cookie' ? 'bg-blue-50 text-blue-900' : api.authMode()==='header' ? 'bg-emerald-50 text-emerald-900' : 'bg-gray-50 text-gray-700'">
        <span class="font-semibold">{{ i18n.t('pages.settings.auth_mode') }}</span>
        <ng-container *ngIf="api.authMode()==='cookie'"> {{ i18n.t('pages.settings.auth_cookie') }}</ng-container>
        <ng-container *ngIf="api.authMode()==='header'"> {{ i18n.t('pages.settings.auth_header') }}</ng-container>
        <ng-container *ngIf="api.authMode()==='unknown'"> {{ i18n.t('pages.settings.auth_unknown') }}</ng-container>
      </div>
      <h1 class="text-lg font-bold mb-2">{{ i18n.t('pages.settings.title') }}</h1>
      <div class="space-y-2">
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="theme.blossoms()" (ngModelChange)="theme.setBlossoms($event)" /> {{ i18n.t('pages.settings.blossoms_animation') }}</label>
        <div class="grid grid-cols-2 gap-2" *ngIf="theme.blossoms()">
          <label class="flex items-center gap-2 col-span-2">{{ i18n.t('pages.settings.density', { value: theme.blossomsDensity() }) }}
            <input type="range" min="10" max="120" [ngModel]="theme.blossomsDensity()" (ngModelChange)="theme.setBlossomsDensity($event)" />
          </label>
          <label class="flex items-center gap-2 col-span-2">{{ i18n.t('pages.settings.speed', { value: (theme.blossomsSpeed() | number:'1.1-1') }) }}
            <input type="range" min="0.5" max="2" step="0.1" [ngModel]="theme.blossomsSpeed()" (ngModelChange)="theme.setBlossomsSpeed($event)" />
          </label>
        </div>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.readerRtl()" (ngModelChange)="settings.setReaderRtl($event)" /> {{ i18n.t('pages.settings.reader_rtl') }}</label>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.readerSpread()" (ngModelChange)="settings.setReaderSpread($event)" /> {{ i18n.t('pages.settings.reader_spread') }}</label>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.forceMobile()" (ngModelChange)="settings.setForceMobile($event)" /> {{ i18n.t('pages.settings.force_mobile') }}</label>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.toolbarIconsOnly()" (ngModelChange)="settings.setToolbarIconsOnly($event)" /> {{ i18n.t('pages.settings.toolbar_compact') }}</label>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.showOfflineBadge()" (ngModelChange)="settings.setShowOfflineBadge($event)" /> {{ i18n.t('pages.settings.offline_badge') }}</label>
        <label class="flex items-center gap-2"><input type="checkbox" [ngModel]="settings.aggressivePrefetch()" (ngModelChange)="settings.setAggressivePrefetch($event)" /> {{ i18n.t('pages.settings.aggressive_prefetch') }}</label>
        <div class="grid grid-cols-2 gap-2" *ngIf="!theme.sakura()">
          <label class="flex items-center gap-2 col-span-2">{{ i18n.t('pages.settings.star_density', { value: theme.starDensity() }) }}
            <input type="range" min="40" max="600" [ngModel]="theme.starDensity()" (ngModelChange)="theme.setStarDensity($event)" />
          </label>
          <label class="flex items-center gap-2 col-span-2"><input type="checkbox" [ngModel]="theme.starfieldEnabled()" (ngModelChange)="theme.setStarfieldEnabled($event)" /> {{ i18n.t('pages.settings.starfield_enabled') }}</label>
        </div>
        <div class="flex flex-wrap gap-2 pt-2">
          <button class="border px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" (click)="theme.preset('sakura-day')">{{ i18n.t('pages.settings.preset_sakura_day') }}</button>
          <button class="border px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" (click)="theme.preset('sakura-night')">{{ i18n.t('pages.settings.preset_sakura_night') }}</button>
          <button class="border px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" (click)="theme.preset('minimal')">{{ i18n.t('pages.settings.preset_minimal') }}</button>
          <button class="border px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" (click)="mobilePreset()">{{ i18n.t('pages.settings.preset_mobile') }}</button>
          <button class="border px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" (click)="resetThemeOnly()" [title]="i18n.t('pages.settings.reset_theme')">{{ i18n.t('pages.settings.reset_theme') }}</button>
          <button class="border px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" (click)="resetAll()">{{ i18n.t('pages.settings.reset_all') }}</button>
        </div>
      </div>
    </div>

    <div class="max-w-xl mx-auto card mt-4">
      <h2 class="font-bold mb-2">{{ i18n.t('pages.settings.change_password') }}</h2>
      <form class="grid gap-2" (ngSubmit)="submitPassword()" autocomplete="on">
        <input class="border p-2 rounded" type="password" [placeholder]="i18n.t('pages.settings.current_password')" [(ngModel)]="currentPassword" name="currentPassword" autocomplete="current-password" required />
        <input class="border p-2 rounded" type="password" [placeholder]="i18n.t('pages.settings.new_password')" [(ngModel)]="newPassword" name="newPassword" autocomplete="new-password" required />
        <button class="bg-matcha text-white rounded px-4 py-2">{{ i18n.t('common.save') }}</button>
      </form>
    </div>

    <div class="max-w-xl mx-auto card mt-4">
      <h2 class="font-bold mb-2">{{ i18n.t('pages.settings.audio_feedback') }}</h2>
      <div class="space-y-2">
        <label class="flex items-center gap-2">
          <input type="checkbox" [ngModel]="sound.enabled" (ngModelChange)="sound.setEnabled($event)" />
          {{ i18n.t('pages.settings.sound_enabled') }}
        </label>
        <label class="flex items-center gap-2">{{ i18n.t('pages.settings.volume', { value: (sound.volume | number:'1.0-2') }) }}
          <input type="range" min="0" max="1" step="0.05" [ngModel]="sound.volume" (ngModelChange)="sound.setVolume($event)" />
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" [ngModel]="haptics.isEnabled()" (ngModelChange)="haptics.setEnabled($event)" />
          {{ i18n.t('pages.settings.haptics_enabled') }}
        </label>
      </div>
    </div>
  `
})
export class SettingsPage implements OnInit {
  constructor(public theme: ThemeService, public api: ApiService, public settings: SettingsService, public sound: SoundService, public haptics: HapticsService, private toast: ToastService, public i18n: I18nService) { }
  ngOnInit(): void { this.theme.apply() }
  currentPassword = ''
  newPassword = ''
  async submitPassword() {
    try {
      await this.api.changePassword(this.currentPassword, this.newPassword)
      this.currentPassword = ''
      this.newPassword = ''
      this.toast.show(this.i18n.t('pages.settings.password_updated'), 'success')
    } catch { this.toast.show(this.i18n.t('pages.settings.password_failed'), 'error') }
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
    this.toast.show(this.i18n.t('pages.settings.reset_confirm_all'), 'info')
  }

  resetThemeOnly() {
    this.theme.preset('sakura-day')
    this.toast.show(this.i18n.t('pages.settings.reset_confirm_theme'), 'info')
  }

  mobilePreset() {
    // Designed for iPhone-size screens: calm blossoms, no stars, 1-up reading
    this.theme.setSakura(true)
    this.theme.setBlossoms(true)
    this.theme.setBlossomsDensity(50)
    this.theme.setBlossomsSpeed(1)
    this.theme.setStarfieldEnabled(false)
    this.settings.setReaderSpread(false)
    this.toast.show(this.i18n.t('pages.settings.preset_mobile') + ' ' + this.i18n.t('common.success'), 'info')
  }
}






