import { Component } from '@angular/core'
import { RouterLink, RouterOutlet } from '@angular/router'
import { ApiService } from './services/api.service'
import { I18nService } from './services/i18n.service'
import { ThemeService } from './services/theme.service'
import { BlossomsComponent } from './components/blossoms.component'
import { SakuraBranchComponent } from './components/sakura-branch.component'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { StarfieldComponent } from './components/starfield.component'
import { BurstService } from './services/burst.service'
import { SoundService } from './services/sound.service'
import { PetalBurstComponent } from './components/petal-burst.component'
import { AfterViewInit, OnDestroy, ViewChild } from '@angular/core'
import { HelpModalComponent } from './components/help-modal.component'
import { ToastContainerComponent } from './components/toast-container.component'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, BlossomsComponent, SakuraBranchComponent, StarfieldComponent, PetalBurstComponent, HelpModalComponent, ToastContainerComponent, MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar class="sakura-bg shadow relative">
      <a routerLink="/library" class="font-bold text-aizome text-xl mr-2">🌸 Manga Shelf</a>
      <app-sakura-branch></app-sakura-branch>
      <span class="text-sm text-aizome" *ngIf="api.email()">{{ api.email() }} ({{ api.role() }})</span>
      <span class="flex-1"></span>
      <nav class="space-x-2 text-sm flex items-center">
        <a mat-button routerLink="/library">{{ i18n.t('library') }}</a>
        <a mat-button *ngIf="api.role()==='admin' || api.role()==='editor'" routerLink="/upload">{{ i18n.t('upload') }}</a>
        <a mat-button *ngIf="api.role()==='admin'" routerLink="/admin">Admin</a>
        <a mat-button routerLink="/settings">{{ i18n.t('settings') }}</a>
        <select class="ml-2 border rounded p-1" (change)="i18n.set(($event.target as HTMLSelectElement).value as any)">
          <option value="de" [selected]="i18n.lang()==='de'">DE</option>
          <option value="en" [selected]="i18n.lang()==='en'">EN</option>
          <option value="ja" [selected]="i18n.lang()==='ja'">日本語</option>
        </select>
        <button *ngIf="api.token()" mat-button (click)="api.logout()">Logout</button>
        <a *ngIf="!api.token()" mat-button routerLink="/login">Login</a>
        <button mat-button (click)="themeMenuOpen = !themeMenuOpen">Theme ▾</button>
        <button mat-button (click)="helpOpen = true">Help</button>
      </nav>
      <div *ngIf="themeMenuOpen" class="absolute right-2 top-12 bg-white shadow rounded p-3 text-sm z-50 min-w-[220px]"
           [ngClass]="{'bg-white text-aizome': theme.sakura(), 'bg-slate-800 text-slate-100': !theme.sakura()}"
      >
        <div class="font-semibold mb-2">Theme Presets</div>
        <div class="space-x-2 mb-2">
          <button class="border px-2 py-1 rounded" (click)="theme.preset('sakura-day'); themeMenuOpen=false">Sakura Day</button>
          <button class="border px-2 py-1 rounded" (click)="theme.preset('sakura-night'); themeMenuOpen=false">Night</button>
          <button class="border px-2 py-1 rounded" (click)="theme.preset('minimal'); themeMenuOpen=false">Minimal</button>
        </div>
        <div class="space-y-1">
          <label class="flex items-center gap-2">
            <input type="checkbox" [checked]="theme.sakura()" (change)="theme.setSakura(($event.target as HTMLInputElement).checked)" /> Sakura an
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" [checked]="theme.blossoms()" (change)="theme.setBlossoms(($event.target as HTMLInputElement).checked)" /> Blüten an
          </label>
          <label class="flex items-center gap-2" *ngIf="!theme.sakura()">
            <input type="checkbox" [checked]="theme.starfieldEnabled()" (change)="theme.setStarfieldEnabled(($event.target as HTMLInputElement).checked)" /> Sterne an
          </label>
        </div>
      </div>
    </mat-toolbar>
    <main class="p-4">
      <router-outlet />
    </main>
    <footer class="p-4 text-center text-xs text-gray-600">
      Nur für private Nutzung. Keine öffentliche Verbreitung.
    </footer>
    <app-blossoms [enabled]="theme.blossoms() && theme.sakura()" [density]="theme.blossomsDensity()" [speed]="theme.blossomsSpeed()"></app-blossoms>
    <app-starfield *ngIf="!theme.sakura() && theme.starfieldEnabled()" [density]="theme.starDensity()"></app-starfield>
    <app-petal-burst #globalBurst></app-petal-burst>
    <app-help-modal [open]="helpOpen" [dayMode]="theme.sakura()" (close)="helpOpen=false"></app-help-modal>
    <app-toast-container></app-toast-container>
  `
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild(PetalBurstComponent) petal!: PetalBurstComponent
  private listener = (count: number, at?: { x: number; y: number }) => { this.petal?.trigger(count, at); this.sound.playBurst() }
  constructor(public api: ApiService, public i18n: I18nService, public theme: ThemeService, private bursts: BurstService, private sound: SoundService) { this.theme.apply() }
  ngAfterViewInit() { this.bursts.on(this.listener) }
  ngOnDestroy() { this.bursts.off(this.listener) }
  themeMenuOpen = false
  helpOpen = false
}

