import { Component } from '@angular/core'
import { I18nService } from '../services/i18n.service'

@Component({
  standalone: true,
  selector: 'app-not-found',
  template: `<div class="p-8 text-center"><h1 class="text-xl font-bold">{{ i18n.t('pages.not_found.title') }}</h1></div>`
})
export class NotFoundPage {
  constructor(public i18n: I18nService) { }
}
