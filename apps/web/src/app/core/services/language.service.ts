import { Injectable, computed, effect, signal } from '@angular/core';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  translations,
  type LanguageCode,
} from '../i18n/translations';

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === 'en' || value === 'th';
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly currentLanguage = signal<LanguageCode>(this.getInitialLanguage());

  readonly current = this.currentLanguage.asReadonly();
  readonly locale = computed(() =>
    this.currentLanguage() === 'th' ? 'th-TH' : 'en-US',
  );

  constructor() {
    effect(() => {
      const language = this.currentLanguage();
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    });
  }

  setLanguage(language: LanguageCode) {
    this.currentLanguage.set(language);
  }

  translate(
    key: string,
    params?: Record<string, string | number | null | undefined>,
  ): string {
    const language = this.currentLanguage();
    const value =
      translations[language][key] ??
      translations[DEFAULT_LANGUAGE][key] ??
      key;

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce((result, [paramKey, paramValue]) => {
      return result.replaceAll(
        `{${paramKey}}`,
        paramValue === null || paramValue === undefined ? '' : String(paramValue),
      );
    }, value);
  }

  enumLabel(value: string): string | null {
    const key = `enum.${value}`;
    const translated = translations[this.currentLanguage()][key] ?? translations[DEFAULT_LANGUAGE][key];
    return translated ?? null;
  }

  private getInitialLanguage(): LanguageCode {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_LANGUAGE;
    }

    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguageCode(stored)) {
      return stored;
    }

    return DEFAULT_LANGUAGE;
  }
}
