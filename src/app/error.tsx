'use client';

import React, { useEffect } from 'react';
import { RefreshCcw, Home } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import Hero from '@/components/Hero';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { T } = useLocale();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Hero
        centered
        badge="Error"
        title={T('common.errorTitle')}
        description={T('common.errorText')}
        actions={
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => reset()}
              className="btn btn--primary btn--lg"
            >
              <RefreshCcw size={20} className="mr-2" />
              {T('common.tryAgain')}
            </button>
            <Link href="/" className="btn btn--secondary btn--lg">
              <Home size={20} className="mr-2" />
              {T('common.backToHome')}
            </Link>
          </div>
        }
      />

      <style jsx>{`
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 12px 32px;
          border-radius: 99px;
          font-weight: 700;
          transition: all 0.3s ease;
        }
        .btn--primary {
          background: var(--accent);
          color: white;
          box-shadow: 0 4px 15px var(--accent-glow);
        }
        .btn--primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px var(--accent-glow);
        }
        .btn--secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border);
        }
        .btn--secondary:hover {
          background: var(--bg-hover);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
