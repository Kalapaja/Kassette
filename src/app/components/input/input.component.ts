import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'kp-input',
  styleUrl: './input.component.css',
  template: `
    @if (label() || comment()) {
      <div class="flex justify-between items-start text-xs font-[421] leading-[14px] tracking-[0.48px] uppercase">
        <label class="text-content-primary" for="input">{{ label() }}</label>
        <span class="text-brand-quaternary">{{ comment() }}</span>
      </div>
    }
    <div
      class="input-wrapper flex items-center h-[60px] px-5 py-[3px] border border-border rounded-lg bg-fill-primary box-border transition-[border-color] duration-150 ease-in-out"
      [class.border-content-primary]="focused()"
    >
      @if (inputPrefix()) {
        <span class="text-xs font-[421] leading-[14px] tracking-[0.48px] uppercase text-content-primary shrink-0 mr-[5px]">{{ inputPrefix() }}</span>
      }
      <input
        id="input"
        class="flex-1 border-none outline-none bg-transparent font-sans text-sm font-[421] leading-[18px] text-content-primary p-0 min-w-0 focus-visible:outline-none"
        [value]="value()"
        [type]="type()"
        [name]="name()"
        [autocomplete]="autocomplete() || 'off'"
        [attr.aria-label]="label() || 'input'"
        [placeholder]="placeholder()"
        (focus)="onFocus()"
        (blur)="onBlur()"
        (input)="onInput($event)"
      />
    </div>
  `,
})
export class InputComponent {
  label = input<string>('');
  comment = input<string>('');
  inputPrefix = input<string>('');
  value = input<string>('');
  placeholder = input<string>('');
  type = input<string>('text');
  name = input<string>('');
  autocomplete = input<string>('');

  valueChange = output<string>();

  focused = signal(false);

  onFocus(): void {
    this.focused.set(true);
  }

  onBlur(): void {
    this.focused.set(false);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valueChange.emit(input.value);
  }
}
