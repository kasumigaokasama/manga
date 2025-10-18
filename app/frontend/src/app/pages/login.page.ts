import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, ActivatedRoute } from '@angular/router'
import { ApiService } from '../services/api.service'
import { ToastService } from '../services/toast.service'
import { BurstService } from '../services/burst.service'

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="max-w-sm mx-auto mt-8 sm:mt-12 card">
      <h1 class="text-lg font-bold mb-2">Anmelden</h1>
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-3" autocomplete="on">
        <label class="block text-sm" for="email">E-Mail</label>
        <input id="email" class="w-full border p-2 rounded" name="email" [(ngModel)]="email" placeholder="E-Mail" type="email" inputmode="email" autocomplete="username" required />
        <label class="block text-sm" for="password">Passwort</label>
        <input id="password" class="w-full border p-2 rounded" name="password" [(ngModel)]="password" placeholder="Passwort" type="password" autocomplete="current-password" required />
        <button class="w-full bg-kurenai text-white p-2 rounded disabled:opacity-50" [disabled]="!f.form.valid">Login</button>
      </form>
    </div>
  `
})
export class LoginPage {
  email = 'admin@example.com'
  password = 'ChangeThis123!'
  constructor(private api: ApiService, private router: Router, private route: ActivatedRoute, private bursts: BurstService, private toast: ToastService) {}
  async submit() {
    try {
      await this.api.login(this.email, this.password)
      this.bursts.trigger(24)
      this.toast.show('Erfolgreich angemeldet', 'success')
      const ret = this.route.snapshot.queryParamMap.get('returnUrl') || '/library'
      this.router.navigateByUrl(ret)
    } catch {
      this.toast.show('Login fehlgeschlagen', 'error')
    }
  }
}
