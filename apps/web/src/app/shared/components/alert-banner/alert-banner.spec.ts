import { TestBed } from '@angular/core/testing';
import { AlertBanner } from './alert-banner';

describe('AlertBanner', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertBanner],
    }).compileComponents();
  });

  it('renders message', () => {
    const fixture = TestBed.createComponent(AlertBanner);
    fixture.componentRef.setInput('message', 'Something went wrong');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Something went wrong');
  });

  it('applies error styling by default', () => {
    const fixture = TestBed.createComponent(AlertBanner);
    fixture.componentRef.setInput('message', 'Error');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.classList.contains('from-red-50')).toBe(true);
  });

  it('applies success styling when type is success', () => {
    const fixture = TestBed.createComponent(AlertBanner);
    fixture.componentRef.setInput('message', 'Done');
    fixture.componentRef.setInput('type', 'success');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.classList.contains('from-emerald-50')).toBe(true);
  });

  it('shows dismiss button when dismissible', () => {
    const fixture = TestBed.createComponent(AlertBanner);
    fixture.componentRef.setInput('message', 'Info');
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();

    const dismissBtn = fixture.nativeElement.querySelector('button[aria-label="Dismiss"]');
    expect(dismissBtn).toBeTruthy();
  });

  it('hides on dismiss', () => {
    const fixture = TestBed.createComponent(AlertBanner);
    fixture.componentRef.setInput('message', 'Dismissable');
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();

    const dismissBtn = fixture.nativeElement.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement;
    dismissBtn.click();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeNull();
  });

  it('does not show dismiss button when not dismissible', () => {
    const fixture = TestBed.createComponent(AlertBanner);
    fixture.componentRef.setInput('message', 'Sticky');
    fixture.detectChanges();

    const dismissBtn = fixture.nativeElement.querySelector('button[aria-label="Dismiss"]');
    expect(dismissBtn).toBeNull();
  });
});
