import { Component } from '@angular/core'
import { I18nService } from '../services/i18n.service'

@Component({
  standalone: true,
  selector: 'app-about',
  template: `
    <div class="prose max-w-2xl mx-auto">
      <h1>{{ i18n.t('pages.about.title') }}</h1>
      <p>{{ i18n.t('pages.about.description') }}</p>
    </div>
  `
})
export class AboutPage {
  constructor(public i18n: I18nService) { }
}



