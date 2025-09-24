import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ApiService } from '../services/api.service'
import { ToastService } from '../services/toast.service'
import { BurstService } from '../services/burst.service'

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="max-w-sm mx-auto mt-10 card">
      <h1 class="text-lg font-bold mb-2">Anmelden</h1>
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-3">
        <input class="w-full border p-2 rounded" name="email" [(ngModel)]="email" placeholder="E-Mail" required />
        <input class="w-full border p-2 rounded" name="password" [(ngModel)]="password" placeholder="Passwort" type="password" required />
        <button class="w-full bg-kurenai text-white p-2 rounded">Login</button>
      </form>
    </div>
  `
})
export class LoginPage {
  email = 'admin@example.com'
  password = 'ChangeThis123!'
  constructor(private api: ApiService, private router: Router, private bursts: BurstService, private toast: ToastService) {}
  async submit() {
    try {
      await this.api.login(this.email, this.password)
      this.bursts.trigger(24)
      this.toast.show('Erfolgreich angemeldet', 'success')
      this.router.navigateByUrl('/library')
    } catch {
      this.toast.show('Login fehlgeschlagen', 'error')
    }
  }
}
