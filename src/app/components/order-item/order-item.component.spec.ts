import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderItemComponent } from './order-item.component';

/**
 * Exposes protected methods on OrderItemComponent so tests can call them directly.
 * Mirrors the typed-view pattern used in price.service.spec.ts.
 */
type OrderItemHarness = OrderItemComponent & {
  discountPercent(): string;
  priceBeforeDiscount(): string;
  totalPrice(): string;
};

interface OrderItemInputs {
  price: number;
  quantity: number;
  discount?: number;
  tax?: number;
}

function createComponent(inputs: OrderItemInputs): {
  fixture: ComponentFixture<OrderItemComponent>;
  cmp: OrderItemHarness;
} {
  const fixture = TestBed.createComponent(OrderItemComponent);
  fixture.componentRef.setInput('price', inputs.price);
  fixture.componentRef.setInput('quantity', inputs.quantity);
  fixture.componentRef.setInput('discount', inputs.discount ?? 0);
  fixture.componentRef.setInput('tax', inputs.tax ?? 0);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as OrderItemHarness };
}

describe('OrderItemComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OrderItemComponent] });
  });

  describe('discountPercent', () => {
    it('uses (subtotal + tax) as the base, not subtotal alone', () => {
      // 10 / (100 + 20) = 8.333… → "8.3"
      const { cmp } = createComponent({ price: 100, quantity: 1, discount: 10, tax: 20 });
      expect(cmp.discountPercent()).toBe('8.3');
    });

    it('renders integer percent without decimal places', () => {
      // 20 / (100 + 0) = 20 → "20"
      const { cmp } = createComponent({ price: 100, quantity: 1, discount: 20, tax: 0 });
      expect(cmp.discountPercent()).toBe('20');
    });

    it('handles quantity > 1 in the base', () => {
      // 5 / (20*2 + 10) = 10 → "10"
      const { cmp } = createComponent({ price: 20, quantity: 2, discount: 5, tax: 10 });
      expect(cmp.discountPercent()).toBe('10');
    });

    it('returns "0" when base is zero (avoids division by zero)', () => {
      const { cmp } = createComponent({ price: 0, quantity: 1, discount: 5, tax: 0 });
      expect(cmp.discountPercent()).toBe('0');
    });
  });

  describe('priceBeforeDiscount', () => {
    it('includes tax in the strikethrough base so it stays > totalPrice', () => {
      const { cmp } = createComponent({ price: 100, quantity: 1, discount: 10, tax: 20 });
      expect(cmp.priceBeforeDiscount()).toBe('120.00');
      expect(cmp.totalPrice()).toBe('110.00');
    });

    it('equals plain subtotal when there is no tax', () => {
      const { cmp } = createComponent({ price: 49.99, quantity: 2, discount: 5, tax: 0 });
      expect(cmp.priceBeforeDiscount()).toBe('99.98');
    });
  });

  describe('totalPrice', () => {
    it('computes subtotal − discount + tax', () => {
      const { cmp } = createComponent({ price: 100, quantity: 1, discount: 10, tax: 20 });
      expect(cmp.totalPrice()).toBe('110.00');
    });

    it('clamps to 0 when discount exceeds subtotal + tax', () => {
      const { cmp } = createComponent({ price: 5, quantity: 1, discount: 100, tax: 0 });
      expect(cmp.totalPrice()).toBe('0.00');
    });
  });
});
