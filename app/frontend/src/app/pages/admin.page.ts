import { Component, OnInit, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService, AdminUser } from '../services/api.service'

@Component({
  standalone: true,
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto grid gap-4">
      <div class="card">
        <h2 class="font-bold mb-2">Benutzer anlegen</h2>
        <form class="grid gap-2 md:grid-cols-4" (ngSubmit)="create()">
          <input class="border p-2 rounded" placeholder="E-Mail" name="email" [(ngModel)]="email" required />
          <input class="border p-2 rounded" placeholder="Passwort" type="password" name="password" [(ngModel)]="password" required />
          <select class="border p-2 rounded" name="role" [(ngModel)]="role">
            <option value="reader">reader</option>
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
          <button class="bg-matcha text-white rounded px-4">Anlegen</button>
        </form>
      </div>
      <div class="card">
        <h2 class="font-bold mb-2">Benutzer</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr><th class="text-left">ID</th><th class="text-left">E-Mail</th><th class="text-left">Rolle</th><th class="text-left">Erstellt</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let u of users()">
                <td>{{ u.id }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <select class="border p-1 rounded" [ngModel]="u.role" (ngModelChange)="updateRole(u, $event)">
                    <option value="reader">reader</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{{ u.createdAt | date:'short' }}</td>
                <td>
                  <button class="bg-gray-200 rounded px-3 py-1 mr-2" (click)="setPassword(u)" title="Passwort setzen" aria-label="Passwort setzen">
                    <span class="material-icons" aria-hidden="true">lock_reset</span>
                  </button>
                  <button class="bg-kurenai text-white rounded px-3 py-1" (click)="remove(u)" title="Benutzer löschen" aria-label="Benutzer löschen">
                    <span class="material-icons" aria-hidden="true">delete</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2 class="font-bold mb-2">Wartung</h2>
        <button class="bg-gray-200 rounded px-3 py-1 mr-2" (click)="heal()" title="Bibliothek reparieren (Formate/Cover)" aria-label="Bibliothek reparieren">
          <span class="material-icons" aria-hidden="true">build</span>
        </button>
      </div>

      <div class="card">
        <h2 class="font-bold mb-2">Audit (neueste Ereignisse)</h2>
        <button class="bg-gray-200 rounded px-3 py-1 mb-2" (click)="loadAudit()">Aktualisieren</button>
        <pre class="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-64">{{ audit() | json }}</pre>
      </div>
    </div>
  `
})
export class AdminPage implements OnInit {
  users = signal<AdminUser[]>([])
  audit = signal<any[]>([])
  email = ''
  password = ''
  role: 'admin' | 'editor' | 'reader' = 'reader'
  private auditTimer: any
  constructor(private api: ApiService) { }
  async ngOnInit() { await this.load(); await this.loadAudit(); this.auditTimer = setInterval(() => this.loadAudit(), 5000) }
  ngOnDestroy() { if (this.auditTimer) clearInterval(this.auditTimer) }
  async load() { try { this.users.set(await this.api.adminListUsers()) } catch { alert('Nicht berechtigt') } }
  async loadAudit() { try { this.audit.set(await this.api.adminListAudit()) } catch { this.audit.set([]) } }
  async create() {
    try {
      await this.api.adminCreateUser(this.email, this.password, this.role)
      this.email = ''; this.password = ''; this.role = 'reader';
      await this.load()
    } catch { alert('Erstellen fehlgeschlagen') }
  }
  async updateRole(u: AdminUser, role: 'admin' | 'editor' | 'reader') {
    try {
      await fetch(`${this.api.base}/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.api.token()}` }, body: JSON.stringify({ role }) })
      await this.load()
    } catch { alert('Update fehlgeschlagen') }
  }
  async remove(u: AdminUser) {
    if (!confirm(`Benutzer ${u.email} löschen?`)) return
    try {
      await fetch(`${this.api.base}/api/users/${u.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.api.token()}` } })
      await this.load()
    } catch { alert('Löschen fehlgeschlagen') }
  }
  async setPassword(u: AdminUser) {
    const p = prompt(`Neues Passwort für ${u.email}:`)
    if (!p) return
    try { await this.api.adminSetPassword(u.id, p); alert('Passwort gesetzt') } catch { alert('Fehlgeschlagen') }
  }
  async heal() {
    try {
      const { fixed } = await this.api.adminHealLibrary()
      alert('Wartung abgeschlossen. Aktualisierte Einträge: ' + fixed)
      await this.load()
    } catch {
      alert('Wartung fehlgeschlagen')
    }
  }
}

