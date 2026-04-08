import { Component, inject, input } from '@angular/core';
import { TranslationService } from '@/app/services/translation.service';

@Component({
  selector: 'kp-order-item',
  styleUrl: './order-item.component.css',
  host: {
    class: 'flex items-start gap-4 w-full box-border pb-2.5 border-b border-border-tetriary font-sans',
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
        <li class="flex flex-wrap gap-4">{{ ts.t('order.item.price') }} <span class="ml-auto">{{ currencySymbol() }}{{ unitPrice() }}</span></li>
        <li class="flex flex-wrap gap-4">{{ ts.t('order.item.quantity') }} <span class="ml-auto">{{ quantity() }}</span></li>
        @if (discount()) {
          <li class="flex flex-wrap gap-4">{{ ts.t('order.item.discount') }} <span class="ml-auto font-semibold text-sm">-{{ currencySymbol() }}{{ formattedDiscount() }} <span class="font-normal text-content-tetriary">({{ discountPercent() }}%)</span></span></li>
        }
        @if (tax()) {
          <li class="flex flex-wrap gap-4">{{ ts.t('order.item.tax') }} <span class="ml-auto">{{ currencySymbol() }}{{ formattedTax() }}</span></li>
        }
        <li class="flex flex-wrap gap-4">{{ ts.t('order.item.totalPrice') }}
          <span class="ml-auto font-semibold text-sm">
            @if (hasDiscount()) {
              <span class="line-through text-content-tetriary font-normal mr-1">{{ currencySymbol() }}{{ subtotal() }}</span>
            }
            {{ currencySymbol() }}{{ totalPrice() }}
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
  price = input<string>('');
  discount = input<string>('');
  tax = input<string>('');
  showImage = input<boolean>(true);

  protected currencySymbol(): string {
    const [currency] = this.price().split(/(\d+)/);
    return currency;
  }

  private parseNumeric(value: string): number {
    const match = value.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  protected unitPrice(): string {
    return this.parseNumeric(this.price()).toFixed(2);
  }

  protected hasDiscount(): boolean {
    return this.parseNumeric(this.discount()) > 0;
  }

  protected formattedDiscount(): string {
    return this.parseNumeric(this.discount()).toFixed(2);
  }

  protected discountPercent(): string {
    const sub = this.parseNumeric(this.price()) * this.quantity();
    if (sub === 0) return '0';
    const pct = (this.parseNumeric(this.discount()) / sub) * 100;
    return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
  }

  protected formattedTax(): string {
    return this.parseNumeric(this.tax()).toFixed(2);
  }

  protected subtotal(): string {
    return (this.parseNumeric(this.price()) * this.quantity()).toFixed(2);
  }

  protected totalPrice(): string {
    const sub = this.parseNumeric(this.price()) * this.quantity();
    const total = Math.max(0, sub - this.parseNumeric(this.discount()) + this.parseNumeric(this.tax()));
    return total.toFixed(2);
  }
}
