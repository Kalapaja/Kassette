import { Component, OnDestroy, OnInit, input, output } from '@angular/core';

@Component({
  selector: 'kp-bottom-sheet',
  styleUrl: './bottom-sheet.component.css',
  host: {
    class: 'block font-sans',
    '[attr.open]': 'open() || null',
    '[attr.scrollable]': 'scrollable() || null',
  },
  template: `
    <div
      class="fixed inset-0 bg-[linear-gradient(to_bottom,oklch(0.75_0_0/0.2),oklch(0.42_0_0/0.2))] opacity-0 pointer-events-none transition-opacity duration-300 ease-in-out motion-reduce:transition-none z-10 host-open:opacity-100 host-open:pointer-events-auto xl:hidden"
      (click)="onOverlayClick()"
    ></div>
    <div
      class="fixed left-0 right-0 bottom-0 max-w-[393px] mx-auto max-h-[85vh] bg-fill-primary rounded-t-[30px] shadow-[0_4px_40px_oklch(0_0_0/0.2)] translate-y-full transition-transform duration-300 ease-in-out motion-reduce:transition-none z-[11] flex flex-col overflow-hidden host-open:translate-y-0 md:max-xl:max-w-[677px] xl:static xl:max-w-[430px] xl:max-h-none xl:rounded-[20px] xl:border xl:border-border-tetriary xl:shadow-none xl:translate-y-0 xl:transition-none xl:m-0"
      role="dialog"
      [attr.aria-label]="title() || dialogLabel()"
    >
      <div class="flex flex-col items-center px-5 py-[10px] shrink-0 xl:hidden">
        <div class="w-[51px] h-0.5 rounded-[4px] bg-border-secondary"></div>
      </div>
      @if (title()) {
        <div class="py-[10px] text-[25px] font-[421] leading-[25px] text-content-primary text-center w-full">{{ title() }}</div>
      }
      <div class="shrink-0 xl:pt-5">
        <ng-content select="[slot=header]" />
      </div>
      <div class="flex flex-col flex-1 min-h-0">
        <div class="flex flex-col gap-[5px] w-full px-5 box-border flex-1 min-h-0 host-scrollable:overflow-y-auto host-scrollable:overflow-x-hidden host-scrollable:overscroll-contain">
          <ng-content />
        </div>
      </div>
      @if (footer()) {
        <div class="text-xs font-[421] leading-5 text-content-tetriary text-center px-5 pt-[10px] pb-5 shrink-0">{{ footer() }}</div>
      }
      <div class="shrink-0">
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
