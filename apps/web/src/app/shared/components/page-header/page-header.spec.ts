import { TestBed } from '@angular/core/testing';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeader],
    }).compileComponents();
  });

  it('renders title', () => {
    const fixture = TestBed.createComponent(PageHeader);
    fixture.componentRef.setInput('title', 'Products');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Products');
  });

  it('renders subtitle when provided', () => {
    const fixture = TestBed.createComponent(PageHeader);
    fixture.componentRef.setInput('title', 'Dashboard');
    fixture.componentRef.setInput('subtitle', 'Overview of today');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Overview of today');
  });

  it('does not render subtitle paragraph when not provided', () => {
    const fixture = TestBed.createComponent(PageHeader);
    fixture.componentRef.setInput('title', 'Orders');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const subtitle = el.querySelector('p');
    expect(subtitle).toBeNull();
  });
});
