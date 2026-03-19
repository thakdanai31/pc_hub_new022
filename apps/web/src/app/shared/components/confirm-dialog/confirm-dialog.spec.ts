import { TestBed } from '@angular/core/testing';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
    }).compileComponents();
  });

  it('is hidden by default', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('message', 'Delete this?');
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('shows dialog when show() is called', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('message', 'Delete this?');
    fixture.detectChanges();

    fixture.componentInstance.show();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Delete this?');
  });

  it('emits confirmed and hides on confirm click', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('message', 'Proceed?');
    fixture.componentRef.setInput('confirmLabel', 'Yes');
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.confirmed.subscribe(() => {
      emitted = true;
    });

    fixture.componentInstance.show();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const confirmBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Yes');
    confirmBtn?.click();
    fixture.detectChanges();

    expect(emitted).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('emits cancelled and hides on cancel click', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('message', 'Proceed?');
    fixture.componentRef.setInput('cancelLabel', 'No');
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => {
      emitted = true;
    });

    fixture.componentInstance.show();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const cancelBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'No');
    cancelBtn?.click();
    fixture.detectChanges();

    expect(emitted).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows destructive styling when destructive is true', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('message', 'Delete?');
    fixture.componentRef.setInput('destructive', true);
    fixture.detectChanges();

    fixture.componentInstance.show();
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('.bg-red-100');
    expect(icon).toBeTruthy();
  });
});
