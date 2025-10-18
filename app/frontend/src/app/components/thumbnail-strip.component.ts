import { Component, EventEmitter, Input, Output } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-thumbnail-strip',
  templateUrl: './thumbnail-strip.component.html',
  styleUrls: ['./thumbnail-strip.component.css']
})
export class ThumbnailStripComponent {
  @Input() pages: number[] = []
  @Input() current = 1
  @Output() jump = new EventEmitter<number>()
}

