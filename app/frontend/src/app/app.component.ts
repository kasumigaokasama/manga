import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router'
import { ApiService } from './services/api.service'
import { SettingsService } from './services/settings.service'
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
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, BlossomsComponent, StarfieldComponent, SakuraBranchComponent, PetalBurstComponent, HelpModalComponent, ToastContainerComponent],
  template: `
    <header *ngIf="showHeader" class="shadow relative" [ngClass]="{ 'sakura-bg': theme.sakura(), 'bg-slate-900': !theme.sakura() }">
      <div class="flex items-center justify-between px-3 py-2">
        <div class="flex items-center gap-2">
          <a routerLink="/library" class="font-bold text-xl mr-2" [ngClass]="theme.sakura() ? 'text-aizome' : 'text-slate-100'">Manga Shelf</a>
          <app-sakura-branch class="hidden sm:block"></app-sakura-branch>
          <span class="text-xs sm:text-sm truncate" [ngClass]="theme.sakura() ? 'text-aizome' : 'text-slate-200'" *ngIf="api.email()">{{ api.email() }} ({{ i18n.t('roles.' + api.role()) }})</span>
        </div>
        <nav class="hidden md:flex items-center space-x-2 text-sm">
          <a routerLink="/library" routerLinkActive #rlaDLib="routerLinkActive" [ngClass]="{'text-kurenai font-semibold': rlaDLib.isActive}">
            <span class="material-icons" aria-hidden="true">local_library</span>
            <span class="ml-1" [class.hidden]="settings.toolbarIconsOnly()">{{ i18n.t('common.library') }}</span>
          </a>
          <a *ngIf="api.role()==='admin' || api.role()==='editor'" routerLink="/upload" routerLinkActive #rlaDUp="routerLinkActive" [ngClass]="{'text-kurenai font-semibold': rlaDUp.isActive}">
            <span class="material-icons" aria-hidden="true">file_upload</span>
            <span class="ml-1" [class.hidden]="settings.toolbarIconsOnly()">{{ i18n.t('common.upload') }}</span>
          </a>
          <a *ngIf="api.role()==='admin'" routerLink="/admin" routerLinkActive #rlaDAdm="routerLinkActive" [ngClass]="{'text-kurenai font-semibold': rlaDAdm.isActive}">
            <span class="material-icons" aria-hidden="true">admin_panel_settings</span>
            <span class="ml-1" [class.hidden]="settings.toolbarIconsOnly()">{{ i18n.t('common.admin') }}</span>
          </a>
          <a routerLink="/settings" routerLinkActive #rlaDSet="routerLinkActive" [ngClass]="{'text-kurenai font-semibold': rlaDSet.isActive}">
            <span class="material-icons" aria-hidden="true">settings</span>
            <span class="ml-1" [class.hidden]="settings.toolbarIconsOnly()">{{ i18n.t('common.settings') }}</span>
          </a>
          <div class="relative inline-block">
            <select 
              class="appearance-none pl-2 pr-6 py-1 rounded border text-xs font-medium cursor-pointer transition-all outline-none" 
              [ngClass]="theme.sakura() ? 'bg-white/80 border-sakura text-aizome hover:bg-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'"
              (change)="onLanguageSelect($event)" 
              [aria-label]="i18n.t('nav.toggle_menu')"
            >
              <option value="de" [selected]="i18n.lang()==='de'">DE</option>
              <option value="en" [selected]="i18n.lang()==='en'">EN</option>
              <option value="ja" [selected]="i18n.lang()==='ja'">JA</option>
            </select>
            <span class="material-icons absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-sm opacity-50" aria-hidden="true">expand_more</span>
          </div>
          <button *ngIf="api.isAuthenticated()" class="px-2 py-1 rounded border" (click)="api.logout()" [aria-label]="i18n.t('common.logout')">{{ i18n.t('common.logout') }}</button>
          <a *ngIf="!api.isAuthenticated()" class="px-2 py-1 rounded border" routerLink="/login" [aria-label]="i18n.t('common.login')">{{ i18n.t('common.login') }}</a>
          <button #themeBtn class="px-2 py-1 rounded border" (click)="themeMenuOpen = !themeMenuOpen" [aria-label]="i18n.t('common.theme')" [attr.aria-expanded]="themeMenuOpen" [attr.aria-pressed]="themeMenuOpen" [ngClass]="{'text-kurenai font-semibold': themeMenuOpen}">{{ i18n.t('common.theme') }}</button>
          <button class="px-2 py-1 rounded border" (click)="helpOpen = true" [aria-label]="i18n.t('common.help')" [attr.aria-pressed]="helpOpen" [ngClass]="{'text-kurenai font-semibold': helpOpen}">{{ i18n.t('common.help') }}</button>
        </nav>
        <button class="md:hidden px-2 py-1 rounded border" (click)="mobileMenuOpen = !mobileMenuOpen" [aria-label]="i18n.t('nav.toggle_menu')">
          <span class="material-icons" aria-hidden="true">menu</span>
        </button>
      </div>
    </header>

    <!-- Theme dropdown -->
    <div *ngIf="themeMenuOpen" #themeMenu class="absolute right-2 mt-2 z-30 bg-white border rounded shadow p-3 text-sm"
         [ngClass]="{'bg-white text-aizome': theme.sakura(), 'bg-slate-800 text-slate-100': !theme.sakura()}">
      <div class="flex gap-2">
        <button class="border px-2 py-1 rounded" (click)="theme.preset('sakura-day'); themeMenuOpen=false">Sakura Day</button>
        <button class="border px-2 py-1 rounded" (click)="theme.preset('sakura-night'); themeMenuOpen=false">Night</button>
        <button class="border px-2 py-1 rounded" (click)="theme.preset('minimal'); themeMenuOpen=false">Minimal</button>
      </div>
      <div class="mt-3 grid gap-2">
        <label class="flex items-center gap-2">
          <input type="checkbox" [checked]="theme.sakura()" (change)="onSakuraToggle($event)" /> {{ i18n.t('pages.settings.sakura_theme') }}
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" [checked]="theme.blossoms()" (change)="theme.setBlossoms($any($event.target).checked)" /> {{ i18n.t('pages.settings.blossoms_animation') }}
        </label>
        <label class="flex items-center gap-2" *ngIf="!theme.sakura()">
          <input type="checkbox" [checked]="theme.starfieldEnabled()" (change)="theme.setStarfieldEnabled($any($event.target).checked)" /> {{ i18n.t('pages.settings.starfield_enabled') }}
        </label>
      </div>
    </div>

    <!-- Mobile menu -->
    <nav *ngIf="mobileMenuOpen" class="md:hidden bg-white/95 backdrop-blur border-b shadow px-3 py-2" aria-label="Navigation mobil">
      <div class="flex flex-col gap-2">
        <a routerLink="/library" routerLinkActive #rlaMLib="routerLinkActive" class="px-2 py-1 rounded" [ngClass]="{'bg-kumo': rlaMLib.isActive}" (click)="mobileMenuOpen=false">{{ i18n.t('common.library') }}</a>
        <a *ngIf="api.role()==='admin' || api.role()==='editor'" routerLink="/upload" routerLinkActive #rlaMUp="routerLinkActive" class="px-2 py-1 rounded" [ngClass]="{'bg-kumo': rlaMUp.isActive}" (click)="mobileMenuOpen=false">{{ i18n.t('common.upload') }}</a>
        <a *ngIf="api.role()==='admin'" routerLink="/admin" routerLinkActive #rlaMAdm="routerLinkActive" class="px-2 py-1 rounded" [ngClass]="{'bg-kumo': rlaMAdm.isActive}" (click)="mobileMenuOpen=false">{{ i18n.t('common.admin') }}</a>
        <a routerLink="/settings" routerLinkActive #rlaMSet="routerLinkActive" class="px-2 py-1 rounded" [ngClass]="{'bg-kumo': rlaMSet.isActive}" (click)="mobileMenuOpen=false">{{ i18n.t('common.settings') }}</a>
        <div class="flex gap-2 items-center">
          <select class="border rounded p-1" (change)="onLanguageSelect($event)" [aria-label]="i18n.t('nav.toggle_menu')">
            <option value="de" [selected]="i18n.lang()==='de'">DE</option>
            <option value="en" [selected]="i18n.lang()==='en'">EN</option>
            <option value="ja" [selected]="i18n.lang()==='ja'">JA</option>
          </select>
          <button *ngIf="api.token()" class="px-2 py-1 rounded border" (click)="api.logout(); mobileMenuOpen=false" [aria-label]="i18n.t('common.logout')">{{ i18n.t('common.logout') }}</button>
          <a *ngIf="!api.token()" class="px-2 py-1 rounded border" routerLink="/login" (click)="mobileMenuOpen=false" [aria-label]="i18n.t('common.login')">{{ i18n.t('common.login') }}</a>
          <button class="px-2 py-1 rounded border" (click)="themeMenuOpen = !themeMenuOpen" [aria-label]="i18n.t('common.theme')">{{ i18n.t('common.theme') }}</button>
          <button class="px-2 py-1 rounded border" (click)="helpOpen = true; mobileMenuOpen=false" [aria-label]="i18n.t('common.help')">{{ i18n.t('common.help') }}</button>
        </div>
      </div>
    </nav>

    <main class="p-4 pb-24 md:pb-4">
      <router-outlet />
    </main>
    <footer class="p-4 text-center text-xs text-gray-600">{{ i18n.t('footer.private_use') }}</footer>
    <div *ngIf="!online()" class="fixed bottom-4 left-4 bg-amber-500 text-white text-xs px-3 py-2 rounded shadow z-50" role="status" aria-live="polite">{{ i18n.t('status.offline_status') }}</div>
    <app-blossoms [enabled]="theme.blossoms()" [density]="theme.blossomsDensity()" [speed]="theme.blossomsSpeed()"></app-blossoms>
    <app-starfield *ngIf="!theme.sakura() && theme.starfieldEnabled()" [density]="theme.starDensity()"></app-starfield>
    <app-petal-burst #globalBurst></app-petal-burst>
    <app-help-modal [open]="helpOpen" [dayMode]="theme.sakura()" (close)="helpOpen=false"></app-help-modal>
    <app-toast-container></app-toast-container>
  `
})
export class AppComponent implements AfterViewInit, OnDestroy {
  themeMenuOpen = false
  mobileMenuOpen = false
  helpOpen = false
  online = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  @ViewChild(PetalBurstComponent) petal!: PetalBurstComponent
  @ViewChild('themeMenu') themeMenuRef?: ElementRef<HTMLElement>
  @ViewChild('themeBtn') themeBtnRef?: ElementRef<HTMLElement>
  // Header visibility control to prevent flash
  showHeader = false

  private listener = (count: number, at?: { x: number; y: number }) => { this.petal?.trigger(count, at); this.sound.playBurst() }

  constructor(
    public api: ApiService,
    public i18n: I18nService,
    public theme: ThemeService,
    public settings: SettingsService,
    private bursts: BurstService,
    private sound: SoundService,
    public router: Router,
    private toast: ToastService
  ) {
    this.theme.apply()

    // Only show header after navigation completes and we are NOT on login page
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.showHeader = e.urlAfterRedirects !== '/login'
      }
    })
  }

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

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.themeMenuOpen) return
    const menuEl = this.themeMenuRef?.nativeElement
    const btnEl = this.themeBtnRef?.nativeElement
    const target = ev.target as Node | null
    if (menuEl && !menuEl.contains(target) && btnEl && !btnEl.contains(target)) {
      this.themeMenuOpen = false
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() { if (this.themeMenuOpen) this.themeMenuOpen = false }

  @HostListener('window:online') onOnline() { this.online.set(true); this.toast.show(this.i18n.t('status.online'), 'info') }
  @HostListener('window:offline') onOffline() { this.online.set(false); this.toast.show(this.i18n.t('status.offline'), 'info') }
}
