import { Component, computed, input, output } from '@angular/core';
import { type FiatParts, fiatPartsToString } from '../../i18n/format';

@Component({
  selector: 'kp-balance-item',
  styleUrl: './balance-item.component.css',
  host: {
    class: 'block',
    '[attr.selected]': 'selected() || null',
  },
  template: `
    <div
      class="flex items-center justify-between h-16 p-[5px] border border-border-secondary rounded-xl box-border cursor-pointer transition-[border-color,background-color,box-shadow] duration-150 ease-in-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 host-selected:border-content-primary host-selected:bg-fill-secondary host-selected:shadow-[0_4px_20px_oklch(0_0_0/0.1)]"
      role="option"
      tabindex="0"
      [attr.aria-selected]="selected()"
      [attr.aria-label]="ariaLabel()"
      (click)="onClick()"
      (keydown)="onKeyDown($event)"
    >
      <div class="flex items-center justify-between flex-1 min-h-px min-w-px px-[10px]">
        <div class="flex items-center gap-[7.5px]">
          <div class="relative w-9 h-9 shrink-0">
            <div class="icon w-9 h-9 flex items-center justify-center">
              <ng-content select="[slot=icon]" />
            </div>
            <div class="chain-badge absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full border-[1.5px] border-fill-primary bg-fill-primary overflow-hidden flex items-center justify-center">
              <ng-content select="[slot=chain-icon]" />
            </div>
          </div>
          <div class="flex flex-col gap-[5px] justify-center">
            <span class="text-sm font-[421] leading-[18px] text-content-primary">{{ name() }}</span>
            @if (selected() && unitPrice()) {
              <span class="inline-flex items-center gap-0.5">
                <span class="text-xs font-[421] leading-[14px] text-content-tetriary">{{ amount() }}</span>
                <span class="flex items-center justify-center w-[9px] h-[9px] shrink-0">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0.5 7.79297L7.79289 0.500076" stroke="#D9D9D9" stroke-linecap="round"/>
                  </svg>
                </span>
                <span class="text-xs font-[421] leading-[14px] text-content-tetriary">{{ unitPrice() }}</span>
              </span>
            } @else {
              <span class="text-xs font-[421] leading-[14px] text-content-tetriary">{{ amount() }}</span>
            }
          </div>
        </div>
        <div class="flex items-center gap-[5px]">
          @if (cryptoValue()) {
            @if (fiatParts()) {
              <span class="flex items-start text-xs font-[421] leading-[14px] text-content-tetriary tabular-nums">
                <span>{{ fiatParts()!.currency }}</span>
                <span>{{ fiatParts()!.integer }}</span>
                <span>{{ fiatParts()!.decimal }}</span>
              </span>
            } @else if (fiatValue()) {
              @if (fiatMatch()) {
                <span class="flex items-start text-xs font-[421] leading-[14px] text-content-tetriary tabular-nums">
                  <span>$</span>
                  <span>{{ fiatMatch()![1] }}</span>
                  <span>.{{ fiatMatch()![3] ?? '00' }}</span>
                </span>
              } @else {
                <span class="flex items-start text-xs font-[421] leading-[14px] text-content-tetriary tabular-nums">{{ fiatValue() }}</span>
              }
            }
            <span class="flex items-baseline text-content-primary tabular-nums">
              <span class="text-lg font-normal leading-3">{{ cryptoValue() }}</span>
            </span>
          } @else {
            @if (valueParts()) {
              <span class="flex items-baseline text-content-primary tabular-nums">
                <span>{{ valueParts()!.currency }}</span>
                <span>{{ valueParts()!.integer }}</span>
                <span class="text-[10px] font-medium leading-4">{{ valueParts()!.decimal }}</span>
              </span>
            } @else if (unitPrice()) {
              @if (valueMatch()) {
                <span class="flex items-baseline text-content-primary tabular-nums">
                  <span>$</span>
                  <span>{{ valueMatch()![1] }}</span>
                  <span class="text-[10px] font-medium leading-4">.{{ valueMatch()![3] ?? '00' }}</span>
                </span>
              } @else {
                <span class="flex items-baseline text-content-primary tabular-nums">{{ unitPrice() }}</span>
              }
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class BalanceItemComponent {
  name = input<string>('');
  amount = input<string>('');
  fiatValue = input<string>('');
  cryptoValue = input<string>('');
  unitPrice = input<string>('');
  selected = input<boolean>(false);
  fiatParts = input<FiatParts | null>(null);
  valueParts = input<FiatParts | null>(null);
  balanceLabel = input<string>('balance');
  valueLabel = input<string>('value');

  select = output<void>();

  protected fiatMatch = computed(() => {
    const fv = this.fiatValue();
    if (!fv) return null;
    return fv.match(/^\$?([\d,]+)(\.(\d+))?$/);
  });

  protected valueMatch = computed(() => {
    const up = this.unitPrice();
    if (!up) return null;
    return up.match(/^\$?([\d,]+)(\.(\d+))?$/);
  });

  protected ariaLabel = computed(() => {
    const fp = this.fiatParts();
    const fv = this.fiatValue();
    const vl = this.valueLabel();
    const valueSuffix = fp
      ? `, ${vl} ${fiatPartsToString(fp)}`
      : fv
        ? `, ${vl} ${fv}`
        : '';
    return `${this.name()}, ${this.balanceLabel()} ${this.amount()}${valueSuffix}`;
  });

  onClick(): void {
    this.select.emit();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onClick();
    }
  }
}
