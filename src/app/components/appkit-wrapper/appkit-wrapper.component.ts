import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'kp-appkit-wrapper',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<appkit-button balance="show" size="md"></appkit-button>`,
  styles: `:host { display: contents; }`,
})
export class AppkitWrapperComponent {}
