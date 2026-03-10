import { Component, input } from '@angular/core';
import type { FiatParts } from '../../i18n/format';

@Component({
  selector: 'kp-order-item',
  styleUrl: './order-item.component.css',
  host: {
    class: 'flex items-start justify-between w-full box-border pb-2.5 border-b border-border-tetriary font-sans',
  },
  template: `
    <div class="flex gap-2 items-start">
      <div class="image w-[41px] h-[41px] rounded-[10px] border-[0.5px] border-border-tetriary overflow-hidden shrink-0">
        <ng-content select="[slot=image]" />
      </div>
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex gap-1 items-center text-sm leading-[18px] text-content-primary">
          <span>{{ name() }}</span>
          <span class="opacity-50 text-right shrink-0">x{{ quantity() }}</span>
        </div>
        @if (description()) {
          <span class="text-sm leading-[18px] text-content-secondary">{{ description() }}</span>
        }
      </div>
    </div>
    @if (priceParts(); as parts) {
      <div class="flex items-center text-base leading-5 text-content-primary">
        <span class="font-[421]">{{ parts.currency }}</span>
        <span>{{ parts.integer }}</span>
        <span>{{ parts.decimal }}</span>
      </div>
    } @else {
      <div class="flex items-center text-base leading-5 text-content-primary">
        @if (currencySymbol()) {
          <span class="font-[421]">{{ currencySymbol() }}</span>
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
