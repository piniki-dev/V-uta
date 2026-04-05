'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toast, ToastItem, ToastType } from './Toast';
import { usePlayer } from './player/PlayerContext';

interface ToastContextType {
  showToast: (message: string, options?: { title?: string; type?: ToastType; duration?: number }) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { state } = usePlayer();
  const [pipOffset, setPipOffset] = useState(0);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: { title?: string; type?: ToastType; duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      id,
      message,
      title: options?.title,
      type: options?.type || 'info',
      duration: options?.duration || 5000,
    };

    setToasts((prev) => [...prev, newToast]);

    if (newToast.duration !== Infinity) {
      setTimeout(() => {
        hideToast(id);
      }, newToast.duration);
    }
  }, [hideToast]);

  // PiPの位置に応じたオフセット計算
  useEffect(() => {
    const isDesktop = window.innerWidth >= 769;
    const isBottomRightPip = !state.isFullPlayerOpen && state.pipPosition === 'bottom-right' && state.currentSong;

    if (isDesktop && isBottomRightPip) {
      // PiPの高さ + 余白
      // 16/9想定: 280 / (16/9) = 157.5
      // 9/16想定: 160 / (9/16) = 284.4
      const pipHeight = state.videoRatio === '9/16' ? 285 : 158;
      setPipOffset(pipHeight + 16);
    } else {
      setPipOffset(0);
    }
  }, [state.pipPosition, state.isFullPlayerOpen, state.currentSong, state.videoRatio]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      
      <div 
        className="toast-container toast-container--bottom-right"
        style={{ 
          transform: pipOffset > 0 ? `translateY(-${pipOffset}px)` : 'none'
        }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onClose={hideToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
