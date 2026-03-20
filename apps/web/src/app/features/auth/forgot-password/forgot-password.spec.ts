import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  let authService: { requestPasswordReset: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      requestPasswordReset: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits the email and shows the development reset link when available', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    const component = fixture.componentInstance;

    authService.requestPasswordReset.mockReturnValue(
      of({
        success: true,
        data: {
          resetLink: 'http://localhost:4200/reset-password?token=test-token',
          expiresAt: '2026-03-20T10:30:00.000Z',
        },
      }),
    );

    component.email = ' user@example.com ';
    component.onSubmit({ valid: true });
    fixture.detectChanges();

    expect(authService.requestPasswordReset).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
    expect(component.requestSent()).toBe(true);

    const link = fixture.nativeElement.querySelector('a[href^="http://localhost:4200/reset-password"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toContain('token=test-token');
  });

  it('maps validation errors to the email field', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    const component = fixture.componentInstance;

    authService.requestPasswordReset.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              fieldErrors: {
                email: 'Please enter a valid email address.',
              },
            },
          }),
      ),
    );

    component.email = 'bad-email';
    component.onSubmit({ valid: true });
    fixture.detectChanges();

    expect(component.serverFieldErrors()).toEqual({
      email: 'Please enter a valid email address.',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Please enter a valid email address.',
    );
  });
});
