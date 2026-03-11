import { inject, Pipe, type PipeTransform } from '@angular/core';

import type { TranslationKey } from '@/app/i18n/index';
import { TranslationService } from '@/app/services/translation.service';

@Pipe({
  name: 'translate',
})
export class TranslatePipe implements PipeTransform {
  private readonly ts = inject(TranslationService);

  transform(key: string, params?: Record<string, string>): string {
    return this.ts.t(key as TranslationKey, params);
  }
}
