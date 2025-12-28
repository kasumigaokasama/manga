import { Component, OnInit, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService, AdminUser } from '../services/api.service'
import { I18nService } from '../services/i18n.service'

@Component({
  standalone: true,
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto grid gap-4">
      <div class="card">
        <h2 class="font-bold mb-2">{{ i18n.t('pages.admin.create_user') }}</h2>
        <form class="grid gap-2 md:grid-cols-4" (ngSubmit)="create()">
          <input class="border p-2 rounded" [placeholder]="i18n.t('pages.admin.field_email')" name="email" [(ngModel)]="email" required />
          <input class="border p-2 rounded" [placeholder]="i18n.t('pages.admin.field_password')" type="password" name="password" [(ngModel)]="password" required />
          <select class="border p-2 rounded" name="role" [(ngModel)]="role" [aria-label]="i18n.t('pages.admin.field_role')">
            <option value="reader">{{ i18n.t('roles.reader') }}</option>
            <option value="editor">{{ i18n.t('roles.editor') }}</option>
            <option value="admin">{{ i18n.t('roles.admin') }}</option>
          </select>
          <button class="bg-matcha text-white rounded px-4">{{ i18n.t('pages.admin.button_create') }}</button>
        </form>
      </div>
      <div class="card">
        <h2 class="font-bold mb-2">{{ i18n.t('pages.admin.users_title') }}</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr><th class="text-left">ID</th><th class="text-left">{{ i18n.t('pages.admin.table_email') }}</th><th class="text-left">{{ i18n.t('pages.admin.table_role') }}</th><th class="text-left">{{ i18n.t('pages.admin.table_created') }}</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let u of users()">
                <td>{{ u.id }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <select class="border p-1 rounded" [ngModel]="u.role" (ngModelChange)="updateRole(u, $event)" [aria-label]="i18n.t('pages.admin.table_role')">
                    <option value="reader">{{ i18n.t('roles.reader') }}</option>
                    <option value="editor">{{ i18n.t('roles.editor') }}</option>
                    <option value="admin">{{ i18n.t('roles.admin') }}</option>
                  </select>
                </td>
                <td>{{ u.createdAt | date:'short' }}</td>
                <td>
                  <button class="bg-gray-200 rounded px-3 py-1 mr-2" (click)="setPassword(u)" [title]="i18n.t('pages.admin.set_password')" [aria-label]="i18n.t('pages.admin.set_password')">
                    <span class="material-icons" aria-hidden="true">lock_reset</span>
                  </button>
                  <button class="bg-kurenai text-white rounded px-3 py-1" (click)="remove(u)" [title]="i18n.t('pages.admin.delete_user')" [aria-label]="i18n.t('pages.admin.delete_user')">
                    <span class="material-icons" aria-hidden="true">delete</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2 class="font-bold mb-2">{{ i18n.t('pages.admin.maintenance') }}</h2>
        <button class="bg-gray-200 rounded px-3 py-1 mr-2" (click)="heal()" [title]="i18n.t('pages.admin.heal_library')" [aria-label]="i18n.t('pages.admin.heal_library')">
          <span class="material-icons" aria-hidden="true">build</span>
        </button>
      </div>

      <div class="card">
        <h2 class="font-bold mb-2">{{ i18n.t('pages.admin.audit_title') }}</h2>
        <button class="bg-gray-200 rounded px-3 py-1 mb-2" (click)="loadAudit()">{{ i18n.t('pages.admin.refresh') }}</button>
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
  constructor(private api: ApiService, public i18n: I18nService) { }
  async ngOnInit() { await this.load(); await this.loadAudit(); this.auditTimer = setInterval(() => this.loadAudit(), 5000) }
  ngOnDestroy() { if (this.auditTimer) clearInterval(this.auditTimer) }
  async load() { try { this.users.set(await this.api.adminListUsers()) } catch { alert(this.i18n.t('pages.admin.not_authorized')) } }
  async loadAudit() { try { this.audit.set(await this.api.adminListAudit()) } catch { this.audit.set([]) } }
  async create() {
    try {
      await this.api.adminCreateUser(this.email, this.password, this.role)
      this.email = ''; this.password = ''; this.role = 'reader';
      await this.load()
    } catch { alert(this.i18n.t('pages.admin.create_failed')) }
  }
  async updateRole(u: AdminUser, role: 'admin' | 'editor' | 'reader') {
    try {
      await fetch(`${this.api.base}/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.api.token()}` }, body: JSON.stringify({ role }) })
      await this.load()
    } catch { alert(this.i18n.t('pages.admin.update_failed')) }
  }
  async remove(u: AdminUser) {
    if (!confirm(this.i18n.t('pages.admin.delete_confirm', { email: u.email }))) return
    try {
      await fetch(`${this.api.base}/api/users/${u.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.api.token()}` } })
      await this.load()
    } catch { alert(this.i18n.t('common.error')) }
  }
  async setPassword(u: AdminUser) {
    const p = prompt(this.i18n.t('pages.admin.set_password') + ` (${u.email}):`)
    if (!p) return
    try { await this.api.adminSetPassword(u.id, p); alert(this.i18n.t('pages.admin.password_set')) } catch { alert(this.i18n.t('common.error')) }
  }
  async heal() {
    try {
      const { fixed } = await this.api.adminHealLibrary()
      alert(this.i18n.t('pages.admin.heal_success', { count: fixed }))
      await this.load()
    } catch {
      alert(this.i18n.t('pages.admin.heal_failed'))
    }
  }
}

