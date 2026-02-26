import { Component, input, output } from '@angular/core';

export type ButtonWeight = 'primary' | 'secondary' | 'tetriary';

@Component({
  selector: 'kp-button',
  styleUrl: './button.component.css',
  host: {
    '[attr.weight]': 'weight()',
    '[attr.disabled]': 'disabled() || null',
    '[attr.pressed]': 'pressed() || null',
  },
  template: `
    @if (label()) {
      <span class="label">{{ label() }}</span>
    }
    <button [disabled]="disabled()" (click)="buttonClick.emit()">
      <span class="btn-content">
        <span class="icon" aria-hidden="true">
          <ng-content select="[slot=icon]">
            <svg viewBox="0 0 12 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6 0L11.5 5.5H7.5V10H4.5V5.5H0.5L6 0Z" />
            </svg>
          </ng-content>
        </span>
        <span class="btn-text"><ng-content /></span>
      </span>
    </button>
  `,
})
export class ButtonComponent {
  weight = input<ButtonWeight>('primary');
  label = input<string>('');
  disabled = input<boolean>(false);
  pressed = input<boolean>(false);

  buttonClick = output<void>();
}
