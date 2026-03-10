import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'kp-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
