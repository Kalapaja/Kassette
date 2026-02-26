import { Routes } from '@angular/router';
import { PaymentLayoutComponent } from './pages/payment/payment-layout.component';
import { invoiceGuard } from './pages/payment/guards/invoice.guard';

export const routes: Routes = [
  {
    path: 'pay/:invoiceId',
    component: PaymentLayoutComponent,
    canActivate: [invoiceGuard],
  },
  { path: '', redirectTo: 'pay', pathMatch: 'full' },
  { path: '**', redirectTo: 'pay' },
];
