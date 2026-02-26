import { Component, input } from '@angular/core';
import type { FiatParts } from '../../i18n/format';

@Component({
  selector: 'kp-order-item',
  styleUrl: './order-item.component.css',
  template: `
    <div class="left">
      <div class="image">
        <ng-content select="[slot=image]" />
      </div>
      <div class="info">
        <div class="name-row">
          <span>{{ name() }}</span>
          <span class="quantity">x{{ quantity() }}</span>
        </div>
        @if (description()) {
          <span class="description">{{ description() }}</span>
        }
      </div>
    </div>
    @if (priceParts(); as parts) {
      <div class="price">
        <span class="currency">{{ parts.currency }}</span>
        <span>{{ parts.integer }}</span>
        <span class="cents">{{ parts.decimal }}</span>
      </div>
    } @else {
      <div class="price">
        @if (currencySymbol()) {
          <span class="currency">{{ currencySymbol() }}</span>
        }
        @if (priceMatch()) {
          <span>{{ priceMatch()![1] }}</span>
          <span>{{ priceMatch()![2] ? '.' + priceMatch()![2].replace('.', '').slice(0, 2).padEnd(2, '0') : '.00' }}</span>
        } @else {
          <span>{{ numericParts() }}</span>
        }
      </div>
    }
  `,
})
export class OrderItemComponent {
  name = input<string>('');
  description = input<string>('');
  quantity = input<number>(1);
  price = input<string>('');
  priceParts = input<FiatParts | null>(null);

  protected currencySymbol(): string {
    const [currency] = this.price().split(/(\d+)/);
    return currency;
  }

  protected numericParts(): string {
    const [, ...rest] = this.price().split(/(\d+)/);
    return rest.join('');
  }

  protected priceMatch(): RegExpMatchArray | null {
    return this.numericParts().match(/^(\d+)(\.?\d*)$/);
  }
}
