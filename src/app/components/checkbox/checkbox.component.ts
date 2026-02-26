import { Component, input, output } from '@angular/core';

@Component({
  selector: 'kp-checkbox',
  styleUrl: './checkbox.component.css',
  host: {
    role: 'checkbox',
    '[attr.checked]': 'checked() || null',
    '[attr.disabled]': 'disabled() || null',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-disabled]': 'disabled()',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '(click)': 'toggle()',
    '(keydown)': 'onKeyDown($event)',
  },
  template: `
    <div class="checkbox">
      @if (checked()) {
        <svg class="checkmark" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.5 5L5 8.5L10.5 3" stroke="currentColor" />
        </svg>
      }
    </div>
    @if (label()) {
      <span class="label">{{ label() }}</span>
    }
  `,
})
export class CheckboxComponent {
  checked = input<boolean>(false);
  disabled = input<boolean>(false);
  label = input<string>('');

  change = output<boolean>();

  toggle(): void {
    if (this.disabled()) return;
    this.change.emit(!this.checked());
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggle();
    }
  }
}
