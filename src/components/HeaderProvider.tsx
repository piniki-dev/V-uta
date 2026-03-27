'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface HeaderContextType {
  isMobileSearchActive: boolean;
  setMobileSearchActive: (active: boolean) => void;
  toggleMobileSearch: () => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);

  const setMobileSearchActive = useCallback((active: boolean) => {
    setIsMobileSearchActive(active);
  }, []);

  const toggleMobileSearch = useCallback(() => {
    setIsMobileSearchActive((prev) => !prev);
  }, []);

  return (
    <HeaderContext.Provider 
      value={{ 
        isMobileSearchActive, 
        setMobileSearchActive, 
        toggleMobileSearch 
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}
