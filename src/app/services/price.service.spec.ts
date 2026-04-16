import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PriceService } from './price.service';

describe('PriceService', () => {
  let service: PriceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PriceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('_buildBatches', () => {
    // `_buildBatches` is private; accessed via a typed view for assertions.
    const buildBatches = (keys: string[]): string[][] =>
      (service as unknown as { _buildBatches(keys: string[]): string[][] })._buildBatches(keys);

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
