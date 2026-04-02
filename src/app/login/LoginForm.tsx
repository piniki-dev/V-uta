'use client';

import { createClient } from '@/utils/supabase/client';
import { useLocale } from '@/components/LocaleProvider';
import { motion } from 'framer-motion';
import { LogIn, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useTheme } from 'next-themes';
import { useEffect, useState, useCallback, useRef } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

interface LoginFormProps {
  initialTranslations: {
    title: string;
    description: string;
    backToHome: string;
  };
}

export default function LoginForm({ initialTranslations }: LoginFormProps) {
  const { T } = useLocale();
  const supabase = createClient();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const googleInitialized = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignInWithIdToken = useCallback(async (response: any) => {
    console.log('Google Sign-In response received');
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      console.log('Auth success:', data);
      if (data?.user) {
        console.log('Redirecting to home...');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error signing in with ID token:', error);
    }
  }, [supabase.auth]);

  const initializeGoogleSignIn = useCallback(() => {
    if (typeof window !== 'undefined' && window.google && !googleInitialized.current) {
      console.log('Initializing Google Sign-In SDK...');
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleSignInWithIdToken,
        auto_select: false,
        ux_mode: 'popup',
      });

      const buttonContainer = document.getElementById('google-signin-button');
      if (buttonContainer) {
        console.log('Rendering Google Sign-In button...');
        window.google.accounts.id.renderButton(buttonContainer, {
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'continue_with',
          locale: 'ja',
        });
      }
      
      googleInitialized.current = true;
    }
  }, [handleSignInWithIdToken, resolvedTheme]);

  useEffect(() => {
    if (mounted && window.google) {
      initializeGoogleSignIn();
    }
  }, [mounted, initializeGoogleSignIn]);

  return (
    <motion.div 
      className="w-full max-w-md relative z-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <Script 
        src="https://accounts.google.com/gsi/client" 
        strategy="afterInteractive"
        onLoad={initializeGoogleSignIn}
      />

      {/* Back button */}
      <Link 
        href="/" 
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all mb-8 group px-4 py-2 rounded-full hover:bg-[var(--bg-secondary)]"
      >
        <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
        <span className="font-bold text-sm tracking-tight">{initialTranslations.backToHome}</span>
      </Link>

      {/* Login Card */}
      <div className="bg-[var(--bg-secondary)]/60 backdrop-blur-3xl border border-[var(--border)] rounded-[48px] p-8 md:p-12 shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden relative group">
        <div className="absolute inset-0 border-2 border-gradient-to-br from-[var(--accent)] to-[#8e4eff] opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none rounded-[48px]" />
        
        <div className="text-center mb-12">
          <motion.div 
            className="w-20 h-20 bg-gradient-to-br from-[var(--accent)] to-[#8e4eff] rounded-[24px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--accent)]/20 rotate-[-5deg]"
            initial={{ scale: 0.8, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: -5, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 12 }}
          >
            <LogIn className="text-white" size={36} strokeWidth={2.5} />
          </motion.div>
          
          <h1 className="text-4xl font-black text-[var(--text-primary)] mb-4 tracking-tighter">
            {initialTranslations.title}
          </h1>
          <p className="text-[var(--text-secondary)] font-medium leading-relaxed px-2">
            {initialTranslations.description}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[52px]">
          {/* Google Login Button Container */}
          <div 
            id="google-signin-button" 
            className="transition-opacity duration-500 overflow-hidden rounded-[var(--radius-full)]" 
            style={{ colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light' }}
          />
          
          {!mounted && (
            <div className="w-[320px] h-[52px] bg-[var(--bg-tertiary)] animate-pulse rounded-full" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
