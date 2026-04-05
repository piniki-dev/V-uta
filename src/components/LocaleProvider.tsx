'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations } from '@/lib/translations';
import { useRouter } from 'next/navigation';

type Locale = 'ja' | 'en';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isJa: boolean;
  isEn: boolean;
  t: (ja: string, en: string) => string;
  T: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ja');
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedLocale = localStorage.getItem('vuta-locale') as Locale;
      if (savedLocale && (savedLocale === 'ja' || savedLocale === 'en')) {
        if (savedLocale !== locale) {
          setLocaleState(savedLocale);
        }
      } else {
        // ブラウザの言語設定を確認
        const browserLang = navigator.language.split('-')[0];
        if (browserLang === 'ja' && locale !== 'ja') {
          setLocaleState('ja');
        } else if (browserLang === 'en' && locale !== 'en') {
          setLocaleState('en');
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('vuta-locale', newLocale);
    // クッキーにも保存（サーバーサイドでの言語判定用）
    document.cookie = `vuta-locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // lang 属性を更新
    document.documentElement.lang = newLocale;
    // サーバーコンポーネントを再描画
    router.refresh();
  };

  const t = (ja: string, en: string) => {
    return locale === 'ja' ? ja : en;
  };

  const T = (keyPath: string, params?: Record<string, string | number>): string => {
    const keys = keyPath.split('.');
    let current: Record<string, unknown> | string = translations[locale];
    
    for (const key of keys) {
      if (typeof current === 'object' && current !== null && (current as Record<string, unknown>)[key] !== undefined) {
        current = (current as Record<string, unknown>)[key] as Record<string, unknown> | string;
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
    // コンテキストが見つからない場合（404ページなど）のフォールバック
    const defaultLocale: Locale = 'ja';
    const T = (keyPath: string): string => {
      const keys = keyPath.split('.');
      let current: Record<string, unknown> | string = translations[defaultLocale];
      for (const key of keys) {
        if (typeof current === 'object' && current !== null && (current as Record<string, unknown>)[key] !== undefined) {
          current = (current as Record<string, unknown>)[key] as Record<string, unknown> | string;
        } else {
          return keyPath;
        }
      }
      return typeof current === 'string' ? current : keyPath;
    };

    return {
      locale: defaultLocale,
      setLocale: () => {},
      isJa: true,
      isEn: false,
      t: (ja: string, _en: string) => ja,
      T,
    } as LocaleContextType;
  }
  
  return context;
}
