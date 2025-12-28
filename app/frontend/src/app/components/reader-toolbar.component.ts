import { Component, EventEmitter, Input, Output } from '@angular/core'
import { I18nService } from '../services/i18n.service'

@Component({
  standalone: true,
  selector: 'app-reader-toolbar',
  templateUrl: './reader-toolbar.component.html',
  styleUrls: ['./reader-toolbar.component.css']
})
export class ReaderToolbarComponent {
  constructor(public i18n: I18nService) { }
  @Input() title = ''
  @Input() page = 1
  @Input() totalPages = 0
  @Input() spread = false
  @Input() rtl = true
  @Input() zoomPercent = 100

  @Output() toggleSpread = new EventEmitter<void>()
  @Output() toggleRtl = new EventEmitter<void>()
  @Output() zoomIn = new EventEmitter<void>()
  @Output() zoomOut = new EventEmitter<void>()
  @Output() prev = new EventEmitter<void>()
  @Output() next = new EventEmitter<void>()
}

