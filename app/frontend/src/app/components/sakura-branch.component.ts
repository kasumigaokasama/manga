import { Component } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-sakura-branch',
  styles: [`
    :host { display: inline-block; height: 28px; margin-left: 8px; }
    svg { height: 100%; overflow: visible; }
    .sway { animation: sway 6s ease-in-out infinite; transform-origin: left center; }
    @keyframes sway { 0%{ transform: rotate(0deg) } 50%{ transform: rotate(2deg) } 100%{ transform: rotate(0deg) } }
  `],
  template: `
  <svg class="sway" viewBox="0 0 120 40" aria-hidden="true">
    <path d="M5 25 C 40 15, 70 10, 115 5" stroke="#0F2D5C" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g fill="#F9D5E5" opacity="0.95">
      <circle cx="25" cy="18" r="5"></circle>
      <circle cx="23" cy="16" r="3" fill="#FFC7D9"></circle>
      <circle cx="55" cy="14" r="5"></circle>
      <circle cx="53" cy="12" r="3" fill="#FFC7D9"></circle>
      <circle cx="85" cy="10" r="5"></circle>
      <circle cx="83" cy="8" r="3" fill="#FFC7D9"></circle>
    </g>
  </svg>
  `
})
export class SakuraBranchComponent {}

