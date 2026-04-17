import { Component, inject, input } from '@angular/core';
import { TranslationService } from '@/app/services/translation.service';

@Component({
  selector: 'kp-order-item',
  styleUrl: './order-item.component.css',
  host: {
    class:
      'flex items-start gap-4 w-full box-border pb-2.5 border-b border-border-tetriary font-sans',
  },
  template: `
    @if (showImage()) {
      <div class="image w-24 h-24 flex p-3 shrink-0 bg-fill-secondary rounded-md">
        <ng-content select="[slot=image]" />
      </div>
    }
    <div class="w-full">
      <h3 class="text-base font-semibold text-content-primary">{{ name() }}</h3>
      <ul class="text-sm text-content-primary space-y-2 mt-3">
        <li class="flex flex-wrap gap-4">
          {{ ts.t('order.item.price') }}
          <span class="ml-auto">{{ currency() }}{{ price().toFixed(2) }}</span>
        </li>
        <li class="flex flex-wrap gap-4">
          {{ ts.t('order.item.quantity') }}
          <span class="ml-auto">{{ quantity() }}</span>
        </li>
        @if (hasDiscount()) {
          <li class="flex flex-wrap gap-4">
            {{ ts.t('order.item.discount') }}
            <span class="ml-auto font-semibold text-sm"
              >-{{ currency() }}{{ discount().toFixed(2) }}
              <span class="font-normal text-content-tetriary">({{ discountPercent() }}%)</span>
            </span>
          </li>
        }
        @if (hasTax()) {
          <li class="flex flex-wrap gap-4">
            {{ ts.t('order.item.tax') }}
            <span class="ml-auto">{{ currency() }}{{ tax().toFixed(2) }}</span>
          </li>
        }
        <li class="flex flex-wrap gap-4">
          {{ ts.t('order.item.totalPrice') }}
          <span class="ml-auto font-semibold text-sm">
            @if (hasDiscount()) {
              <span class="line-through text-content-tetriary font-normal mr-1"
                >{{ currency() }}{{ priceBeforeDiscount() }}</span
              >
            }
            {{ currency() }}{{ totalPrice() }}
          </span>
        </li>
      </ul>
    </div>
  `,
})
export class OrderItemComponent {
  protected readonly ts = inject(TranslationService);
  name = input<string>('');
  description = input<string>('');
  quantity = input<number>(1);
  price = input<number>(0);
  discount = input<number>(0);
  tax = input<number>(0);
  currency = input<string>('$');
  showImage = input<boolean>(true);

  protected hasDiscount(): boolean {
    return this.discount() > 0;
  }

  protected hasTax(): boolean {
    return this.tax() > 0;
  }

  protected discountPercent(): string {
    const base = this.price() * this.quantity() + this.tax();
    if (base === 0) return '0';
    const pct = (this.discount() / base) * 100;
    return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
  }

  // Base = subtotal + tax, so the strikethrough value always equals totalPrice + discount.
  protected priceBeforeDiscount(): string {
    return (this.price() * this.quantity() + this.tax()).toFixed(2);
  }

  protected totalPrice(): string {
    const sub = this.price() * this.quantity();
    const total = Math.max(0, sub - this.discount() + this.tax());
    return total.toFixed(2);
  }
}
