import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@angular/compiler';
import { PriceService } from './price.service';

describe('PriceService', () => {
  let service: PriceService;

  beforeEach(() => {
    service = Object.create(PriceService.prototype);
    // Inject mock HttpClient (not used for _buildBatches but required for prototype)
    (service as any).http = { get: vi.fn() };
  });

  describe('_buildBatches', () => {
    const buildBatches = (keys: string[]) => (service as any)._buildBatches(keys);

    it('returns empty array for empty input', () => {
      expect(buildBatches([])).toEqual([]);
    });

    it('puts all keys in single batch when under URL limit', () => {
      const keys = ['coingecko:ethereum', 'polygon:0xabc'];
      const result = buildBatches(keys);
      expect(result).toEqual([keys]);
    });

    it('splits into multiple batches when exceeding URL limit', () => {
      // BASE_URL is ~40 chars, MAX_URL_LENGTH is 4000
      // Generate keys that exceed the limit
      const longKey = 'x'.repeat(1000);
      const keys = [longKey, longKey, longKey, longKey, longKey];
      const result = buildBatches(keys);
      expect(result.length).toBeGreaterThan(1);
      // All keys should be present across batches
      const allKeys = result.flat();
      expect(allKeys).toEqual(keys);
    });

    it('does not create empty batches', () => {
      const keys = ['a', 'b', 'c'];
      const result = buildBatches(keys);
      for (const batch of result) {
        expect(batch.length).toBeGreaterThan(0);
      }
    });

    it('handles single key', () => {
      const keys = ['coingecko:ethereum'];
      expect(buildBatches(keys)).toEqual([keys]);
    });
  });
});
