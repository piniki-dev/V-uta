'use client';

import Hero from '@/components/Hero';
import { useLocale } from '@/components/LocaleProvider';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  const { T } = useLocale();

  return (
    <div className="legal-page">
      <Hero 
        title={T('legal.terms')}
        description={T('legal.termsContent.intro')}
        icon={<FileText size={48} />}
        centered
      />

      <div className="container page-content">
        <section className="legal-section">
          <h2>{T('legal.termsContent.title')}</h2>
          <p>{T('legal.termsContent.intro')}</p>
        </section>

        <section className="legal-section">
          <h2>YouTube Terms</h2>
          <p>{T('legal.termsContent.youtube')}</p>
          <a 
            href="https://www.youtube.com/t/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-accent underline hover:text-accent-hover block mt-4"
          >
            {T('legal.youtubeTos')}
          </a>
        </section>

        <section className="legal-section">
          <h2>{T('common.details')}</h2>
          <p>{T('legal.termsContent.prohibited')}</p>
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
        .text-accent {
          color: var(--accent);
          transition: color var(--transition);
        }
        .mt-4 {
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
}
