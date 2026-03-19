import { TestBed } from '@angular/core/testing';
import { LoadingSkeleton } from './loading-skeleton';

describe('LoadingSkeleton', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingSkeleton],
    }).compileComponents();
  });

  it('renders card variant by default', () => {
    const fixture = TestBed.createComponent(LoadingSkeleton);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.shimmer')).toBeTruthy();
    expect(el.querySelector('.aspect-square')).toBeTruthy();
  });

  it('renders multiple cards when count is set', () => {
    const fixture = TestBed.createComponent(LoadingSkeleton);
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.skeleton-item');
    expect(cards.length).toBe(3);
  });

  it('renders table-row variant', () => {
    const fixture = TestBed.createComponent(LoadingSkeleton);
    fixture.componentRef.setInput('variant', 'table-row');
    fixture.componentRef.setInput('count', 2);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.skeleton-item');
    expect(rows.length).toBe(2);
  });

  it('renders detail variant', () => {
    const fixture = TestBed.createComponent(LoadingSkeleton);
    fixture.componentRef.setInput('variant', 'detail');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.shimmer')).toBeTruthy();
  });
});
