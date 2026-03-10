import { Component, input, output } from '@angular/core';

export type ModeValue = 'light' | 'dark';

@Component({
  selector: 'kp-mode',
  styles: `:host { display: inline-flex; align-items: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }`,
  host: {
    '[attr.mode]': 'mode()',
  },
  template: `
    <div
      class="flex items-center p-0.5 rounded-[30px] gap-0 cursor-pointer select-none"
      role="radiogroup"
      [attr.aria-label]="groupLabel()"
      (keydown)="onKeyDown($event)"
    >
      <button
        class="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-transparent border-none p-0 cursor-pointer text-border transition-[color] duration-150 ease-in-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 hover:text-muted-foreground aria-checked:text-content-primary aria-checked:hover:text-content-primary"
        role="radio"
        [attr.aria-checked]="mode() === 'light' ? 'true' : 'false'"
        [attr.aria-label]="lightLabel()"
        [tabindex]="mode() === 'light' ? 0 : -1"
        (click)="select('light')"
      >
        <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1"/>
          <line x1="6" y1="0.5" x2="6" y2="2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          <line x1="6" y1="10" x2="6" y2="11.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          <line x1="0.5" y1="6" x2="2" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          <line x1="10" y1="6" x2="11.5" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          <line x1="2.11" y1="2.11" x2="3.17" y2="3.17" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          <line x1="8.83" y1="8.83" x2="9.89" y2="9.89" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          <line x1="9.89" y1="2.11" x2="8.83" y2="3.17" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          <line x1="3.17" y1="8.83" x2="2.11" y2="9.89" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        class="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-transparent border-none p-0 cursor-pointer text-border transition-[color] duration-150 ease-in-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 hover:text-muted-foreground aria-checked:text-content-primary aria-checked:hover:text-content-primary"
        role="radio"
        [attr.aria-checked]="mode() === 'dark' ? 'true' : 'false'"
        [attr.aria-label]="darkLabel()"
        [tabindex]="mode() === 'dark' ? 0 : -1"
        (click)="select('dark')"
      >
        <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.5 6.75C10.5 9.37 8.37 11.5 5.75 11.5C3.67 11.5 1.91 10.15 1.28 8.28C1.56 8.38 1.87 8.44 2.19 8.44C4.21 8.44 5.84 6.81 5.84 4.79C5.84 3.46 5.14 2.3 4.1 1.65C4.62 1.39 5.2 1.25 5.81 1.25C8.4 1.25 10.5 3.35 10.5 5.94V6.75Z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `,
})
export class ModeComponent {
  mode = input<ModeValue>('light');
  groupLabel = input<string>('Color mode');
  lightLabel = input<string>('Light mode');
  darkLabel = input<string>('Dark mode');

  modeChange = output<ModeValue>();

  select(value: ModeValue): void {
    if (this.mode() === value) return;
    this.modeChange.emit(value);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.select('light');
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.select('dark');
    }
  }
}
