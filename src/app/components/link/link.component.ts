import { Component, input } from '@angular/core';

@Component({
  selector: 'kp-link',
  styleUrl: './link.component.css',
  template: `
    <a
      class="appearance-none box-border inline-flex items-center justify-center py-[7.5px] border-b border-border cursor-pointer transition-[border-color] duration-150 ease-in-out hover:border-content-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      [attr.href]="href() || '#'"
      [attr.target]="target() || null"
      [attr.rel]="target() === '_blank' ? 'noopener noreferrer' : null"
      (click)="handleClick($event)"
    >
      <span class="flex items-center gap-[5px]">
        <span class="text-sm leading-[18px] font-[421] text-content-primary"><ng-content /></span>
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
