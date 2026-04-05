'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, Info, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import './Toast.css';

export type ToastType = 'info' | 'success' | 'error' | 'warning' | 'privacy';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const Icon = {
    info: Info,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    privacy: ShieldCheck,
  }[toast.type || 'info'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`toast-item toast-item--${toast.type || 'info'}`}
    >
      <div className="toast-item__icon">
        <Icon size={20} />
      </div>
      <div className="toast-item__content">
        {toast.title && <div className="toast-item__title">{toast.title}</div>}
        <div className="toast-item__message">{toast.message}</div>
      </div>
      <button 
        className="toast-item__close" 
        onClick={() => onClose(toast.id)}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};
