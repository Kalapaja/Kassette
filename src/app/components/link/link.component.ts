import { Component, input } from '@angular/core';

@Component({
  selector: 'kp-link',
  styleUrl: './link.component.css',
  template: `
    <a
      [attr.href]="href() || '#'"
      [attr.target]="target() || null"
      [attr.rel]="target() === '_blank' ? 'noopener noreferrer' : null"
      (click)="handleClick($event)"
    >
      <span class="context">
        <span class="text"><ng-content /></span>
      </span>
    </a>
  `,
})
export class LinkComponent {
  href = input<string>('');
  target = input<string>('');

  handleClick(e: Event): void {
    if (!this.href()) {
      e.preventDefault();
    }
  }
}
