import { TestBed } from '@angular/core/testing';
import { LanguageSwitcher } from './language-switcher';
import { LanguageService } from '../../../core/services/language.service';
import { LANGUAGE_STORAGE_KEY } from '../../../core/i18n/translations';

describe('LanguageSwitcher', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('switches language and persists the selection', () => {
    TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
    });

    const fixture = TestBed.createComponent(LanguageSwitcher);
    const language = TestBed.inject(LanguageService);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    fixture.detectChanges();

    expect(language.current()).toBe('th');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('th');
  });
});
