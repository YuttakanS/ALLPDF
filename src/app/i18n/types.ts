import type { TranslationKey } from './th';

export type Locale = 'th' | 'en';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}
