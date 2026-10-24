import React, { useCallback, useState, useMemo } from 'react';
import { I18nContext } from './context';
import { th, type TranslationKey } from './th';
import { en } from './en';
import type { Locale } from './types';

const STORAGE_KEY = 'allpdf_locale';

export const I18nProvider: React.FC<{ children: React.ReactNode; defaultLocale?: Locale }> = ({
  children,
  defaultLocale = 'th',
}) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'th' || saved === 'en') return saved;
    }
    return defaultLocale;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === 'th' ? 'en' : 'th';
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const dictionary = useMemo(() => (locale === 'en' ? en : th), [locale]);

  const t = useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>): string => {
      let str = dictionary[key] ?? th[key] ?? key;
      if (params) {
        for (const [paramKey, paramVal] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        }
      }
      return str;
    };
  }, [dictionary]);

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
