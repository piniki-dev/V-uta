'use client';

import Hero from '@/components/Hero';
import { useLocale } from '@/components/LocaleProvider';
import { Info, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const { T } = useLocale();

  return (
    <div className="legal-page">
      <Hero
        title={T('legal.about')}
        description={T('legal.aboutContent.description')}
        icon={<Info size={48} />}
        centered
      />

      <div className="container page-content">

        <section className="legal-section">
          <h2>{T('common.details')}</h2>
          <p>{T('legal.aboutContent.disclaimer')}</p>
          <p className="mt-4">
            {T('legal.poweredByYoutube')}
          </p>
        </section>

        <section className="mt-16 bg-gradient-to-br from-[var(--accent)]/10 to-transparent border border-[var(--accent)]/20 text-center rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent)] to-indigo-500 opacity-50" />
          <div className="flex flex-col items-center gap-4">
            <h2 className="font-heading text-2xl md:text-3xl font-bold m-0">{T('legal.contact')}</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              {T('contact.subtitle')}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-[var(--accent)] to-indigo-500 text-white font-bold rounded-full transition-all duration-300 shadow-lg shadow-[var(--accent-glow)] hover:scale-105 hover:shadow-xl hover:shadow-[var(--accent-glow)] active:scale-95"
            >
              <MessageCircle size={20} className="mr-2" />
              {T('contact.title')}
            </Link>
          </div>
        </section>
      </div>

      <style jsx>{`
        .legal-page {
          min-height: 100vh;
        }
        .page-content {
          padding: 64px 24px;
          max-width: 800px;
          margin: 0 auto;
        }
        .legal-section {
          margin-bottom: 48px;
        }
        h2 {
          font-family: var(--font-heading);
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 20px;
          color: var(--text-primary);
        }
        p {
          font-size: 16px;
          line-height: 1.8;
          color: var(--text-secondary);
          word-break: break-word;
        }
        .mt-4 {
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
}
