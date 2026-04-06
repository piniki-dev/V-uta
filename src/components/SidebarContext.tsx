'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  open: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // 初期状態を「開いた状態」にする
  const [isOpen, setIsOpen] = useState(true);

  // モバイル初期化時に画面幅に応じて閉じる
  useEffect(() => {
    // 起動時の初期チェック（setTimeout で同期 setState を回避）
    const timer = setTimeout(() => {
      if (window.innerWidth <= 768) {
        setIsOpen(false);
      }
    }, 0);

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggle = () => setIsOpen(prev => !prev);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close, open }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
