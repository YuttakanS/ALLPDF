import { useContext } from 'react';
import { I18nContext } from './context';
import { th, type TranslationKey } from './th';
import type { I18nContextValue } from './types';

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'th',
      setLocale: () => {},
      toggleLocale: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        let str = th[key] ?? key;
        if (params) {
          for (const [paramKey, paramVal] of Object.entries(params)) {
            str = str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
          }
        }
        return str;
      },
    };
  }
  return ctx;
}
