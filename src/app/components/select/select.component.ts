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
      <label class="text-xs font-[421] leading-[14px] tracking-[0.48px] uppercase text-content-primary">{{ label() }}</label>
    }
    <button
      class="trigger appearance-none box-border flex items-center cursor-pointer font-sans text-sm font-[421] leading-[18px] text-content-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 weight-tetriary:gap-1 weight-primary:h-[60px] weight-primary:px-5 weight-primary:py-[3px] weight-primary:border weight-primary:border-border weight-primary:rounded-lg weight-primary:bg-fill-primary weight-primary:justify-between weight-primary:w-full weight-primary:transition-[border-color] weight-primary:duration-150 weight-primary:ease-in-out weight-primary:hover:border-content-primary weight-primary:focus-visible:border-content-primary"
      role="combobox"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
      [attr.aria-label]="label() || ariaFallbackLabel()"
      (click)="toggle()"
      (keydown)="handleTriggerKeyDown($event)"
    >
      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" [class.opacity-30]="!selectedLabel()">
        {{ selectedLabel() || placeholder() }}
      </span>
      <span class="flex items-center justify-center shrink-0 w-[11px] h-[11px] transition-transform duration-150 ease-in-out" [class.rotate-180]="isOpen()">
        <svg class="w-[11px] h-[11px]" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M2.5 4L5.5 7L8.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </button>
    @if (isOpen()) {
      <div class="absolute top-full left-0 z-10 mt-1 min-w-full bg-fill-primary rounded-[4px] shadow-[0_0_10px_0_oklch(0_0_0/0.25)] overflow-hidden weight-primary:rounded-lg" role="listbox">
        @for (option of options(); track option.value; let i = $index) {
          @if (i > 0) {
            <div class="h-px bg-border"></div>
          }
          <button
            class="option appearance-none box-border flex items-center justify-center w-full p-[10px] font-sans text-sm font-[421] leading-[18px] text-content-primary cursor-pointer hover:bg-brand-quinary focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
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
