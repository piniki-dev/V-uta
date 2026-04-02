import React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import Hero from '@/components/Hero';

export default async function NotFound() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Hero
        centered
        badge="404"
        title={t.common.notFoundTitle}
        description={t.common.notFoundText}
        actions={
          <Link href="/" className="btn btn--primary btn--lg items-center">
            <Home size={20} className="mr-2" />
            {t.common.backToHome}
          </Link>
        }
      />

      <style>{`
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
