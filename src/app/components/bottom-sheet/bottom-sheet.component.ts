import { Component, OnDestroy, OnInit, input, output } from '@angular/core';

@Component({
  selector: 'kp-bottom-sheet',
  styleUrl: './bottom-sheet.component.css',
  host: {
    '[attr.open]': 'open() || null',
    '[attr.scrollable]': 'scrollable() || null',
  },
  template: `
    <div class="overlay" (click)="onOverlayClick()"></div>
    <div
      class="sheet"
      role="dialog"
      [attr.aria-label]="title() || dialogLabel()"
    >
      <div class="handle-area">
        <div class="handle"></div>
      </div>
      @if (title()) {
        <div class="title">{{ title() }}</div>
      }
      <div class="header-slot">
        <ng-content select="[slot=header]" />
      </div>
      <div class="body">
        <div class="content">
          <ng-content />
        </div>
      </div>
      @if (footer()) {
        <div class="footer-text">{{ footer() }}</div>
      }
      <div class="footer-slot">
        <ng-content select="[slot=footer]" />
      </div>
    </div>
  `,
})
export class BottomSheetComponent implements OnInit, OnDestroy {
  open = input<boolean>(false);
  title = input<string>('');
  footer = input<string>('');
  scrollable = input<boolean>(false);
  dialogLabel = input<string>('Bottom sheet');

  close = output<void>();

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open()) {
      this.emitClose();
    }
  };

  ngOnInit(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onOverlayClick(): void {
    this.emitClose();
  }

  private emitClose(): void {
    this.close.emit();
  }
}
