import { type CanActivateFn } from '@angular/router';

export const invoiceGuard: CanActivateFn = (route) => {
  const invoiceId = route.queryParamMap.get('invoice_id');

  if (!invoiceId) {
    return false;
  }

  return true;
};
