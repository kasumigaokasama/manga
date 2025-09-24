import { Component, AfterViewInit, OnDestroy, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink, RouterOutlet } from '@angular/router'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { ApiService } from './services/api.service'
import { I18nService } from './services/i18n.service'
import { ThemeService } from './services/theme.service'
import { BurstService } from './services/burst.service'
import { SoundService } from './services/sound.service'
import { ToastService } from './services/toast.service'
import { BlossomsComponent } from './components/blossoms.component'
import { StarfieldComponent } from './components/starfield.component'
import { SakuraBranchComponent } from './components/sakura-branch.component'
import { PetalBurstComponent } from './components/petal-burst.component'
import { HelpModalComponent } from './components/help-modal.component'
import { ToastContainerComponent } from './components/toast-container.component'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    BlossomsComponent,
    StarfieldComponent,
    SakuraBranchComponent,
    PetalBurstComponent,
    HelpModalComponent,
    ToastContainerComponent
  ],
  template: `
    <mat-toolbar class="sakura-bg shadow relative">
      <a routerLink="/library" class="font-bold text-aizome text-xl mr-2">Manga Shelf</a>
      <app-sakura-branch></app-sakura-branch>
      <span class="text-sm text-aizome" *ngIf="api.email()">{{ api.email() }} ({{ api.role() }})</span>
      <span class="flex-1"></span>
      <nav class="space-x-2 text-sm flex items-center">
        <a mat-button routerLink="/library">{{ i18n.t('library') }}</a>
        <a mat-button *ngIf="api.role()==='admin' || api.role()==='editor'" routerLink="/upload">{{ i18n.t('upload') }}</a>
        <a mat-button *ngIf="api.role()==='admin'" routerLink="/admin">Admin</a>
        <a mat-button routerLink="/settings">{{ i18n.t('settings') }}</a>
        <select class="ml-2 border rounded p-1" (change)="onLanguageSelect($event)">
          <option value="de" [selected]="i18n.lang()==='de'">DE</option>
          <option value="en" [selected]="i18n.lang()==='en'">EN</option>
          <option value="ja" [selected]="i18n.lang()==='ja'">JA</option>
        </select>
        <button *ngIf="api.token()" mat-button (click)="api.logout()">Logout</button>
        <a *ngIf="!api.token()" mat-button routerLink="/login">Login</a>
        <button mat-button (click)="themeMenuOpen = !themeMenuOpen">Theme</button>
        <button mat-button (click)="helpOpen = true">Help</button>
      </nav>
      <div *ngIf="themeMenuOpen" class="absolute right-2 top-12 bg-white shadow rounded p-3 text-sm z-50 min-w-[220px]"
           [ngClass]="{'bg-white text-aizome': theme.sakura(), 'bg-slate-800 text-slate-100': !theme.sakura()}">
        <div class="font-semibold mb-2">Theme Presets</div>
        <div class="space-x-2 mb-2">
          <button class="border px-2 py-1 rounded" (click)="theme.preset('sakura-day'); themeMenuOpen=false">Sakura Day</button>
          <button class="border px-2 py-1 rounded" (click)="theme.preset('sakura-night'); themeMenuOpen=false">Night</button>
          <button class="border px-2 py-1 rounded" (click)="theme.preset('minimal'); themeMenuOpen=false">Minimal</button>
        </div>
        <div class="space-y-1">
          <label class="flex items-center gap-2">
            <input type="checkbox" [checked]="theme.sakura()" (change)="onSakuraToggle($event)" /> Sakura an
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" [checked]="theme.blossoms()" (change)="theme.setBlossoms($any($event.target).checked)" /> Blueten an
          </label>
          <label class="flex items-center gap-2" *ngIf="!theme.sakura()">
            <input type="checkbox" [checked]="theme.starfieldEnabled()" (change)="theme.setStarfieldEnabled($any($event.target).checked)" /> Sterne an
          </label>
        </div>
      </div>
    </mat-toolbar>
    <main class="p-4">
      <router-outlet />
    </main>
    <footer class="p-4 text-center text-xs text-gray-600">
      Nur fuer private Nutzung. Keine oeffentliche Verbreitung.
    </footer>
    <app-blossoms [enabled]="theme.blossoms()" [density]="theme.blossomsDensity()" [speed]="theme.blossomsSpeed()"></app-blossoms>
    <app-starfield *ngIf="!theme.sakura() && theme.starfieldEnabled()" [density]="theme.starDensity()"></app-starfield>
    <app-petal-burst #globalBurst></app-petal-burst>
    <app-help-modal [open]="helpOpen" [dayMode]="theme.sakura()" (close)="helpOpen=false"></app-help-modal>
    <app-toast-container></app-toast-container>
  `
})
export class AppComponent implements AfterViewInit, OnDestroy {
  themeMenuOpen = false
  helpOpen = false
  @ViewChild(PetalBurstComponent) petal!: PetalBurstComponent
  private listener = (count: number, at?: { x: number; y: number }) => { this.petal?.trigger(count, at); this.sound.playBurst() }
  constructor(
    public api: ApiService,
    public i18n: I18nService,
    public theme: ThemeService,
    private bursts: BurstService,
    private sound: SoundService,
    private toast: ToastService
  ) { this.theme.apply() }
  ngAfterViewInit() { this.bursts.on(this.listener) }
  ngOnDestroy() { this.bursts.off(this.listener) }
  onLanguageSelect(event: Event) {
    const value = (event.target as HTMLSelectElement | null)?.value
    if (value === 'de' || value === 'en' || value === 'ja') this.i18n.set(value as any)
  }
  onSakuraToggle(event: Event) {
    const checked = (event.target as HTMLInputElement | null)?.checked ?? false
    this.theme.setSakura(checked)
  }
}
