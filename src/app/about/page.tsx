'use client';

import Hero from '@/components/Hero';
import { useLocale } from '@/components/LocaleProvider';
import { Info } from 'lucide-react';

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
          <h2>{T('legal.aboutContent.title')}</h2>
          <p>{T('legal.aboutContent.description')}</p>
        </section>

        <section className="legal-section">
          <h2>{T('common.details')}</h2>
          <p>{T('legal.aboutContent.disclaimer')}</p>
          <p className="mt-4">
            {T('legal.poweredByYoutube')}
          </p>
        </section>

        <section className="legal-section">
          <h2>{T('legal.contact')}</h2>
          <p>{T('legal.aboutContent.contactEmail')}</p>
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
