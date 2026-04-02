'use client';

import React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import Hero from '@/components/Hero';

export default function NotFound() {
  const { T } = useLocale();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Hero
        centered
        badge="404"
        title={T('common.notFoundTitle')}
        description={T('common.notFoundText')}
        actions={
          <Link href="/" className="btn btn--primary btn--lg items-center">
            <Home size={20} className="mr-2" />
            {T('common.backToHome')}
          </Link>
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
      `}</style>
    </div>
  );
}
