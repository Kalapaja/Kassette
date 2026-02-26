import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export type SelectWeight = 'primary' | 'tetriary';

export interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'kp-select',
  styleUrl: './select.component.css',
  host: {
    '[attr.weight]': 'weight()',
  },
  template: `
    @if (label() && weight() === 'primary') {
      <label class="field-name">{{ label() }}</label>
    }
    <button
      class="trigger"
      role="combobox"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
      [attr.aria-label]="label() || ariaFallbackLabel()"
      (click)="toggle()"
      (keydown)="handleTriggerKeyDown($event)"
    >
      <span class="trigger-text" [class.placeholder]="!selectedLabel()">
        {{ selectedLabel() || placeholder() }}
      </span>
      <span class="chevron" [class.open]="isOpen()">
        <svg viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M2.5 4L5.5 7L8.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </button>
    @if (isOpen()) {
      <div class="dropdown" role="listbox">
        @for (option of options(); track option.value; let i = $index) {
          @if (i > 0) {
            <div class="divider"></div>
          }
          <button
            class="option"
            role="option"
            [attr.aria-selected]="option.value === value()"
            tabindex="0"
            (click)="select(option)"
            (keydown)="handleOptionKeyDown($event, option)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    }
  `,
})
export class SelectComponent implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);

  weight = input<SelectWeight>('primary');
  label = input<string>('');
  placeholder = input<string>('');
  ariaFallbackLabel = input<string>('Select an option');
  value = input<string>('');
  options = input<SelectOption[]>([]);

  change = output<{ value: string; label: string }>();

  isOpen = signal(false);

  selectedLabel = computed(() => {
    const selected = this.options().find((o) => o.value === this.value());
    return selected ? selected.label : null;
  });

  private readonly handleDocumentClick = (e: MouseEvent) => {
    if (!this.elementRef.nativeElement.contains(e.target as Node)) {
      this.isOpen.set(false);
    }
  };

  ngOnInit(): void {
    document.addEventListener('click', this.handleDocumentClick);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleDocumentClick);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  select(option: SelectOption): void {
    this.isOpen.set(false);
    this.change.emit({ value: option.value, label: option.label });
  }

  handleTriggerKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.isOpen.set(false);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.isOpen.set(true);
      requestAnimationFrame(() => {
        const firstOption =
          this.elementRef.nativeElement.querySelector('.option');
        (firstOption as HTMLElement)?.focus();
      });
    }
  }

  handleOptionKeyDown(e: KeyboardEvent, option: SelectOption): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.select(option);
    } else if (e.key === 'Escape') {
      this.isOpen.set(false);
      const trigger = this.elementRef.nativeElement.querySelector('.trigger');
      (trigger as HTMLElement)?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (e.target as HTMLElement).nextElementSibling
        ?.nextElementSibling as HTMLElement;
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (e.target as HTMLElement).previousElementSibling
        ?.previousElementSibling as HTMLElement;
      if (prev?.classList.contains('option')) {
        prev.focus();
      }
    }
  }
}
