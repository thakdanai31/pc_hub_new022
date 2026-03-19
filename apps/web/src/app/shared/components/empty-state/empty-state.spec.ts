import { TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyState],
    }).compileComponents();
  });

  it('renders title', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'No items found');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No items found');
  });

  it('renders description when provided', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Empty');
    fixture.componentRef.setInput('description', 'Try adjusting your filters');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Try adjusting your filters');
  });

  it('renders action button when actionLabel is provided', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Empty');
    fixture.componentRef.setInput('actionLabel', 'Go Back');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Go Back');
  });

  it('emits action event on button click', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Empty');
    fixture.componentRef.setInput('actionLabel', 'Retry');
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.action.subscribe(() => {
      emitted = true;
    });

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(emitted).toBe(true);
  });

  it('does not render button when no actionLabel', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Empty');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button).toBeNull();
  });
});
