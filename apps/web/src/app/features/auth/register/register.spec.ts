import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { LANGUAGE_STORAGE_KEY } from '../../../core/i18n/translations';
import { Register } from './register';

describe('Register', () => {
  let router: Router;
  let authService: { register: ReturnType<typeof vi.fn> };

  function fillValidForm(component: Register) {
    component.firstName = ' John ';
    component.lastName = ' Doe ';
    component.email = ' user@example.com ';
    component.phoneNumber = '081-234 5678';
    component.password = 'password123';
    component.confirmPassword = 'password123';
  }

  beforeEach(() => {
    localStorage.clear();

    authService = {
      register: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does not submit when confirm password does not match', () => {
    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component.confirmPassword = 'different123';

    component.onSubmit({ valid: true });
    fixture.detectChanges();

    expect(authService.register).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Passwords do not match.');
  });

  it('toggles password visibility for both password fields', () => {
    const fixture = TestBed.createComponent(Register);
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

  it('maps duplicate email errors to the email field', () => {
    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;
    authService.register.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { code: 'EMAIL_TAKEN' },
      })),
    );

    fillValidForm(component);
    component.onSubmit({ valid: true });
    fixture.detectChanges();

    expect(component.serverFieldErrors()).toEqual({
      email: 'This email is already registered.',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('This email is already registered.');
  });

  it('maps duplicate phone errors to the phone number field', () => {
    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;
    authService.register.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { code: 'PHONE_TAKEN' },
      })),
    );

    fillValidForm(component);
    component.onSubmit({ valid: true });
    fixture.detectChanges();

    expect(component.serverFieldErrors()).toEqual({
      phoneNumber: 'This phone number is already registered.',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('This phone number is already registered.');
  });

  it('submits the registration payload without confirmPassword', () => {
    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    authService.register.mockReturnValue(
      of({
        success: true,
        data: {
          user: {
            id: 1,
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'CUSTOMER',
            isActive: true,
          },
          accessToken: 'token',
        },
      }),
    );

    fillValidForm(component);
    component.onSubmit({ valid: true });

    expect(authService.register).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'user@example.com',
      phoneNumber: '081-234 5678',
      password: 'password123',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('renders translated Thai text when the saved language is Thai', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'th');

    const fixture = TestBed.createComponent(Register);
    const language = TestBed.inject(LanguageService);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(language.translate('auth.register.title'));
    expect(el.textContent).toContain(language.translate('nav.signIn'));
  });
});
