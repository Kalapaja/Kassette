import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

async function bootstrap() {
  if (!import.meta.env.PROD) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' }).catch(() => {
      console.warn('[MSW] Failed to start mock service worker, continuing without mocks');
    });
  }

  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((err) => console.error(err));
