import { Component, inject } from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcher {
  protected readonly language = inject(LanguageService);
}
