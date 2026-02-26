import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

export const invoiceGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const invoiceId = route.paramMap.get('invoiceId');

  if (!invoiceId) {
    return router.parseUrl('/pay');
  }

  return true;
};
