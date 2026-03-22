'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations } from '@/lib/translations';

type Locale = 'ja' | 'en';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isJa: boolean;
  isEn: boolean;
  t: (ja: string, en: string) => string;
  T: (key: string, params?: Record<string, any>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ja');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLocale = localStorage.getItem('vuta-locale') as Locale;
    if (savedLocale && (savedLocale === 'ja' || savedLocale === 'en')) {
      setLocaleState(savedLocale);
    } else {
      // ブラウザの言語設定を確認
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'ja') {
        setLocaleState('ja');
      } else if (browserLang === 'en') {
        setLocaleState('en');
      }
    }
    setMounted(true);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('vuta-locale', newLocale);
    // クッキーにも保存（サーバーサイドでの言語判定用）
    document.cookie = `vuta-locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // lang 属性を更新
    document.documentElement.lang = newLocale;
  };

  const t = (ja: string, en: string) => {
    return locale === 'ja' ? ja : en;
  };

  const T = (keyPath: string, params?: Record<string, any>): string => {
    const keys = keyPath.split('.');
    let current: any = translations[locale];
    
    for (const key of keys) {
      if (current[key] !== undefined) {
        current = current[key];
      } else {
        console.warn(`Translation key not found: ${keyPath} (${locale})`);
        return keyPath;
      }
    }
    
    let result = typeof current === 'string' ? current : keyPath;
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
      });
    }
    
    return result;
  };

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        isJa: locale === 'ja',
        isEn: locale === 'en',
        t,
        T,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
