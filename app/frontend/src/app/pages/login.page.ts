import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, ActivatedRoute } from '@angular/router'
import { CommonModule } from '@angular/common'
import { ApiService } from '../services/api.service'
import { ToastService } from '../services/toast.service'
import { BurstService } from '../services/burst.service'
import { I18nService } from '../services/i18n.service'

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [FormsModule, CommonModule],
  template: `
    <!-- Full-screen gradient background -->
    <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden login-bg">
      <!-- Animated background orbs -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
      </div>

      <!-- Login card with glassmorphism -->
      <div class="login-card w-full max-w-md relative z-10">
        <!-- Logo/Brand section -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 shadow-lg mb-4">
            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-1">Manga Shelf</h1>
          <p class="text-gray-500 dark:text-gray-400 text-sm">{{ i18n.t('pages.login.welcome') }}</p>
        </div>

        <!-- Login form -->
        <form (ngSubmit)="submit()" #f="ngForm" class="space-y-5" autocomplete="on">
          <!-- Email field -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300" for="email">
              {{ i18n.t('pages.login.email') }}
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                </svg>
              </div>
              <input 
                id="email" 
                name="email" 
                type="email" 
                inputmode="email" 
                autocomplete="username"
                [(ngModel)]="email" 
                placeholder="admin@example.com"
                required
                class="login-input"
              />
            </div>
          </div>

          <!-- Password field -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300" for="password">
              {{ i18n.t('pages.login.password') }}
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              </div>
              <input 
                id="password" 
                name="password" 
                [type]="showPassword ? 'text' : 'password'" 
                autocomplete="current-password"
                [(ngModel)]="password" 
                placeholder="••••••••"
                required
                class="login-input"
              />
              <button 
                type="button" 
                (click)="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                [title]="showPassword ? i18n.t('pages.login.hide_password') : i18n.t('pages.login.show_password')"
                [aria-label]="showPassword ? i18n.t('pages.login.hide_password') : i18n.t('pages.login.show_password')"
              >
                <svg *ngIf="!showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                <svg *ngIf="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Submit button -->
          <button 
            type="submit"
            [disabled]="!f.form.valid || loading"
            class="login-button w-full"
          >
            <span *ngIf="!loading">{{ i18n.t('pages.login.signin') }}</span>
            <span *ngIf="loading" class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ i18n.t('pages.login.signing_in') }}
            </span>
          </button>
        </form>

        <!-- Footer hint -->
        <p class="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          {{ i18n.t('pages.login.footer_hint') }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-bg {
      background: linear-gradient(135deg, #fdf2f8 0%, #f5f3ff 50%, #eff6ff 100%);
    }
    :host-context(.theme-dark) .login-bg {
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #1e293b 100%);
    }

    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.6;
      animation: float 20s ease-in-out infinite;
    }
    .orb-1 {
      width: 400px;
      height: 400px;
      background: linear-gradient(135deg, #f9a8d4, #f472b6);
      top: -100px;
      left: -100px;
      animation-delay: 0s;
    }
    .orb-2 {
      width: 300px;
      height: 300px;
      background: linear-gradient(135deg, #c4b5fd, #a78bfa);
      bottom: -50px;
      right: -50px;
      animation-delay: -7s;
    }
    .orb-3 {
      width: 200px;
      height: 200px;
      background: linear-gradient(135deg, #93c5fd, #60a5fa);
      top: 50%;
      left: 50%;
      animation-delay: -14s;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(30px, -30px) scale(1.05); }
      50% { transform: translate(-20px, 20px) scale(0.95); }
      75% { transform: translate(20px, 30px) scale(1.02); }
    }

    .login-card {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 24px;
      padding: 2.5rem;
      box-shadow: 
        0 25px 50px -12px rgba(0, 0, 0, 0.15),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    }
    :host-context(.theme-dark) .login-card {
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .login-input {
      width: 100%;
      padding: 0.875rem 3rem;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 1rem;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.8);
      text-align: center;
    }
    .login-input:focus {
      outline: none;
      border-color: #ec4899;
      box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.1);
    }
    :host-context(.theme-dark) .login-input {
      background: rgba(51, 65, 85, 0.8);
      border-color: #475569;
      color: #f1f5f9;
    }
    :host-context(.theme-dark) .login-input:focus {
      border-color: #f472b6;
      box-shadow: 0 0 0 4px rgba(244, 114, 182, 0.15);
    }
    .login-input::placeholder {
      color: #9ca3af;
    }

    .login-button {
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
      color: white;
      font-weight: 600;
      font-size: 1rem;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4);
    }
    .login-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(236, 72, 153, 0.5);
    }
    .login-button:active:not(:disabled) {
      transform: translateY(0);
    }
    .login-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  `]
})
export class LoginPage {
  email = ''
  password = ''
  showPassword = false
  loading = false

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private bursts: BurstService,
    private toast: ToastService,
    public i18n: I18nService
  ) { }

  async submit() {
    if (this.loading) return
    this.loading = true

    try {
      await this.api.login(this.email, this.password)
      this.bursts.trigger(24)
      this.toast.show(this.i18n.t('pages.login.success'), 'success')
      const ret = this.route.snapshot.queryParamMap.get('returnUrl') || '/library'
      this.router.navigateByUrl(ret)
    } catch {
      this.toast.show(this.i18n.t('pages.login.failed'), 'error')
    } finally {
      this.loading = false
    }
  }
}

