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
      <span class="text-xs font-[421] leading-[14px] tracking-[0.48px] uppercase text-content-primary weight-primary:text-brand-primary weight-primary-disabled:text-content-primary weight-secondary-pressed:text-brand-primary">{{ label() }}</span>
    }
    <button
      class="appearance-none box-border flex items-center justify-center gap-1 w-full h-[60px] px-[15px] py-[10px] rounded-full cursor-pointer transition-all duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 hover:enabled:opacity-85 weight-primary:bg-content-primary weight-primary:text-brand-quinary weight-primary:rounded-[32px] weight-primary-pressed:rounded-full weight-primary-disabled:bg-brand-quinary weight-primary-disabled:text-brand-quaternary weight-primary-disabled:cursor-default weight-primary-disabled:rounded-full weight-secondary:bg-brand-quinary weight-secondary:border weight-secondary:border-brand-border-tetriary weight-secondary:text-content-primary weight-secondary-pressed:bg-brand-primary weight-secondary-pressed:border-brand-primary weight-secondary-pressed:text-fill-primary weight-secondary-disabled:bg-brand-quinary weight-secondary-disabled:border-brand-border-tetriary weight-secondary-disabled:text-brand-quaternary weight-secondary-disabled:cursor-default weight-tetriary:bg-transparent weight-tetriary:border weight-tetriary:border-brand-border-tetriary weight-tetriary:text-content-primary weight-tetriary-pressed:bg-brand-quinary weight-tetriary-pressed:border-content-primary weight-tetriary-disabled:bg-transparent weight-tetriary-disabled:border-brand-border-tetriary weight-tetriary-disabled:text-brand-border-tetriary weight-tetriary-disabled:cursor-default"
      [disabled]="disabled()"
      (click)="buttonClick.emit()"
    >
      <span class="flex items-center gap-0.5">
        <span class="flex items-center justify-center w-6 h-6" aria-hidden="true">
          <ng-content select="[slot=icon]">
            <svg class="w-[11.5px] h-[10px] weight-primary:fill-brand-quinary weight-primary-disabled:fill-brand-quaternary weight-secondary:fill-content-primary weight-secondary-pressed:fill-fill-primary weight-secondary-disabled:fill-brand-quaternary weight-tetriary:fill-content-primary weight-tetriary-disabled:fill-brand-border-tetriary" viewBox="0 0 12 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6 0L11.5 5.5H7.5V10H4.5V5.5H0.5L6 0Z" />
            </svg>
          </ng-content>
        </span>
        <span class="text-sm font-[421] leading-[18px]"><ng-content /></span>
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
