import { TestBed } from '@angular/core/testing';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadge],
    }).compileComponents();
  });

  it('renders formatted label from status', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'AWAITING_PAYMENT');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.trim()).toBe('Awaiting Payment');
  });

  it('renders custom label when provided', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'PENDING');
    fixture.componentRef.setInput('label', 'Waiting');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.trim()).toBe('Waiting');
  });

  it('applies correct classes for known status', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'DELIVERED');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('span') as HTMLSpanElement;
    expect(badge.classList.contains('from-emerald-50')).toBe(true);
    expect(badge.classList.contains('text-emerald-700')).toBe(true);
  });

  it('falls back to neutral style for unknown status', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'UNKNOWN_STATUS');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('span') as HTMLSpanElement;
    expect(badge.classList.contains('bg-slate-100')).toBe(true);
    expect(badge.classList.contains('text-slate-600')).toBe(true);
  });
});
