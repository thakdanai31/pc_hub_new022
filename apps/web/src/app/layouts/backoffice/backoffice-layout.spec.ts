import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BackofficeLayout } from './backoffice-layout';
import { AuthService } from '../../core/services/auth.service';

function mockAuthService(role: 'STAFF' | 'ADMIN') {
  return {
    user: () => ({
      id: 1,
      email: 'backoffice@test.com',
      firstName: 'Back',
      lastName: 'Office',
      role,
      isActive: true,
    }),
    logout: () => ({ subscribe: () => undefined }),
  };
}

describe('BackofficeLayout', () => {
  it('hides Daily Sales navigation from staff while keeping other store links', () => {
    TestBed.configureTestingModule({
      imports: [BackofficeLayout],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService('STAFF') },
      ],
    });

    const fixture = TestBed.createComponent(BackofficeLayout);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Orders');
    expect(el.textContent).toContain('Inventory');
    expect(el.textContent).not.toContain('Daily Sales');
  });

  it('shows Daily Sales navigation for admin', () => {
    TestBed.configureTestingModule({
      imports: [BackofficeLayout],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService('ADMIN') },
      ],
    });

    const fixture = TestBed.createComponent(BackofficeLayout);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Daily Sales');
  });
});
