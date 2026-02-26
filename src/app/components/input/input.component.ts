import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'kp-input',
  styleUrl: './input.component.css',
  template: `
    @if (label() || comment()) {
      <div class="info">
        <label class="field-name" for="input">{{ label() }}</label>
        <span class="comment">{{ comment() }}</span>
      </div>
    }
    <div class="input-wrapper" [class.focused]="focused()">
      @if (inputPrefix()) {
        <span class="prefix">{{ inputPrefix() }}</span>
      }
      <input
        id="input"
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
