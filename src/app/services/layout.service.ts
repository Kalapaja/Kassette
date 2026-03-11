import { Injectable, OnDestroy, signal } from '@angular/core';

const TABLET_BREAKPOINT = '(min-width: 768px)';
const DESKTOP_BREAKPOINT = '(min-width: 1200px)';

@Injectable({ providedIn: 'root' })
export class LayoutService implements OnDestroy {
  readonly isTablet = signal(false);
  readonly isDesktop = signal(false);

  private readonly tabletMql: MediaQueryList;
  private readonly desktopMql: MediaQueryList;

  private readonly onTabletChange = (e: MediaQueryListEvent): void => {
    this.isTablet.set(e.matches);
  };

  private readonly onDesktopChange = (e: MediaQueryListEvent): void => {
    this.isDesktop.set(e.matches);
  };

  constructor() {
    this.tabletMql = window.matchMedia(TABLET_BREAKPOINT);
    this.desktopMql = window.matchMedia(DESKTOP_BREAKPOINT);

    this.isTablet.set(this.tabletMql.matches);
    this.isDesktop.set(this.desktopMql.matches);

    this.tabletMql.addEventListener('change', this.onTabletChange);
    this.desktopMql.addEventListener('change', this.onDesktopChange);
  }

  ngOnDestroy(): void {
    this.tabletMql.removeEventListener('change', this.onTabletChange);
    this.desktopMql.removeEventListener('change', this.onDesktopChange);
  }
}
