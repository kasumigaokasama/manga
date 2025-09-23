import { Routes } from '@angular/router'
import { authGuard, roleGuard } from './auth.guard'

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'library' },
  { path: 'login', loadComponent: () => import('./pages/login.page').then(m => m.LoginPage) },
  { path: 'library', canMatch: [authGuard], loadComponent: () => import('./pages/library.page').then(m => m.LibraryPage) },
  { path: 'upload', canMatch: [authGuard, roleGuard(['admin','editor'])], loadComponent: () => import('./pages/upload.page').then(m => m.UploadPage) },
  { path: 'reader/:id', canMatch: [authGuard], loadComponent: () => import('./pages/reader.page').then(m => m.ReaderPage) },
  { path: 'settings', canMatch: [authGuard], loadComponent: () => import('./pages/settings.page').then(m => m.SettingsPage) },
  { path: 'admin', canMatch: [authGuard, roleGuard(['admin'])], loadComponent: () => import('./pages/admin.page').then(m => m.AdminPage) },
  { path: 'about', loadComponent: () => import('./pages/about.page').then(m => m.AboutPage) },
  { path: '**', loadComponent: () => import('./pages/not-found.page').then(m => m.NotFoundPage) }
]
