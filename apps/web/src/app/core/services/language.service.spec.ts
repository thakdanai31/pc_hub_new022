import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from '../i18n/translations';

describe('LanguageService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('defaults to English when no saved language exists', () => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);

    TestBed.configureTestingModule({});
    const service = TestBed.inject(LanguageService);

    expect(service.current()).toBe(DEFAULT_LANGUAGE);
  });

  it('restores the saved language from localStorage', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'th');

    TestBed.configureTestingModule({});
    const service = TestBed.inject(LanguageService);

    expect(service.current()).toBe('th');
  });

  it('persists language changes to localStorage', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(LanguageService);

    service.setLanguage('th');
    TestBed.flushEffects();

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('th');
  });
});
