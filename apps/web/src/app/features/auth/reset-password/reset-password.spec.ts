import { HttpErrorResponse } from '@angular/common/http';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  let authService: { resetPassword: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      resetPassword: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ token: 'valid-reset-token' }),
            },
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not submit when confirm password does not match', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    const component = fixture.componentInstance;

    component.password = 'password123';
    component.confirmPassword = 'different123';
    component.onSubmit({ valid: true });
    fixture.detectChanges();

    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Passwords do not match.',
    );
  });

  it('toggles password visibility for both fields', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();

    const passwordInput = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const confirmPasswordInput = fixture.nativeElement.querySelector('#confirmPassword') as HTMLInputElement;
    const passwordToggle = fixture.nativeElement.querySelector('[aria-label="Show password"]') as HTMLButtonElement;
    const confirmPasswordToggle = fixture.nativeElement.querySelector('[aria-label="Show confirm password"]') as HTMLButtonElement;

    expect(passwordInput.type).toBe('password');
    expect(confirmPasswordInput.type).toBe('password');

    passwordToggle.click();
    confirmPasswordToggle.click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('text');
    expect(confirmPasswordInput.type).toBe('text');
  });

  it('submits the reset payload without confirmPassword', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    const component = fixture.componentInstance;

    authService.resetPassword.mockReturnValue(
      of({
        success: true,
        data: null,
      }),
    );

    component.password = 'newpassword123';
    component.confirmPassword = 'newpassword123';
    component.onSubmit({ valid: true });

    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'valid-reset-token',
      password: 'newpassword123',
    });
    expect(component.resetComplete()).toBe(true);
  });

  it('maps expired token errors to the reset form', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    const component = fixture.componentInstance;

    authService.resetPassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              code: 'RESET_TOKEN_EXPIRED',
            },
          }),
      ),
    );

    component.password = 'newpassword123';
    component.confirmPassword = 'newpassword123';
    component.onSubmit({ valid: true });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This reset link has expired. Please request a new one.',
    );
  });
});
