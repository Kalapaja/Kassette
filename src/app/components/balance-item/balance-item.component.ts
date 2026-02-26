import { Component, computed, input, output } from '@angular/core';
import { type FiatParts, fiatPartsToString } from '../../i18n/format';

@Component({
  selector: 'kp-balance-item',
  styleUrl: './balance-item.component.css',
  host: {
    '[attr.selected]': 'selected() || null',
  },
  template: `
    <div
      class="row"
      role="option"
      tabindex="0"
      [attr.aria-selected]="selected()"
      [attr.aria-label]="ariaLabel()"
      (click)="onClick()"
      (keydown)="onKeyDown($event)"
    >
      <div class="inner">
        <div class="left">
          <div class="icon-wrapper">
            <div class="icon">
              <ng-content select="[slot=icon]" />
            </div>
            <div class="chain-badge">
              <ng-content select="[slot=chain-icon]" />
            </div>
          </div>
          <div class="info">
            <span class="name">{{ name() }}</span>
            @if (selected() && unitPrice()) {
              <span class="amount-with-rate">
                <span class="amount">{{ amount() }}</span>
                <span class="amount-separator">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0.5 7.79297L7.79289 0.500076" stroke="#D9D9D9" stroke-linecap="round"/>
                  </svg>
                </span>
                <span class="amount">{{ unitPrice() }}</span>
              </span>
            } @else {
              <span class="amount">{{ amount() }}</span>
            }
          </div>
        </div>
        <div class="right">
          @if (cryptoValue()) {
            @if (fiatParts()) {
              <span class="fiat">
                <span>{{ fiatParts()!.currency }}</span>
                <span>{{ fiatParts()!.integer }}</span>
                <span class="fiat-decimal">{{ fiatParts()!.decimal }}</span>
              </span>
            } @else if (fiatValue()) {
              @if (fiatMatch()) {
                <span class="fiat">
                  <span>$</span>
                  <span>{{ fiatMatch()![1] }}</span>
                  <span class="fiat-decimal">.{{ fiatMatch()![3] ?? '00' }}</span>
                </span>
              } @else {
                <span class="fiat">{{ fiatValue() }}</span>
              }
            }
            <span class="value">
              <span class="value-integer">{{ cryptoValue() }}</span>
            </span>
          } @else {
            @if (valueParts()) {
              <span class="value">
                <span>{{ valueParts()!.currency }}</span>
                <span>{{ valueParts()!.integer }}</span>
                <span class="value-decimal">{{ valueParts()!.decimal }}</span>
              </span>
            } @else if (unitPrice()) {
              @if (valueMatch()) {
                <span class="value">
                  <span>$</span>
                  <span>{{ valueMatch()![1] }}</span>
                  <span class="value-decimal">.{{ valueMatch()![3] ?? '00' }}</span>
                </span>
              } @else {
                <span class="value">{{ unitPrice() }}</span>
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
