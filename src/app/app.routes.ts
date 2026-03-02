import { Routes } from '@angular/router';
import { PaymentLayoutComponent } from './pages/payment/payment-layout.component';
import { invoiceGuard } from './pages/payment/guards/invoice.guard';

export const routes: Routes = [
  {
    path: '',
    component: PaymentLayoutComponent,
    canActivate: [invoiceGuard],
  },
  { path: '**', redirectTo: '' },
];
