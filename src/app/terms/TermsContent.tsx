'use client';

import Hero from '@/components/Hero';
import { FileText } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import JsonLd from '@/components/JsonLd';

export default function TermsContent() {
  const { T } = useLocale();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": T('sidebar.home'),
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": T('legal.terms'),
        "item": `${baseUrl}/terms`
      }
    ]
  };

  return (
    <div className="min-h-screen pb-20">
      <JsonLd data={breadcrumbData} />
      <Hero 
        title={T('legal.terms')}
        description={T('legal.termsContent.intro')}
        icon={<FileText size={48} />}
        centered
      />

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{T('legal.termsContent.title')}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{T('legal.termsContent.intro')}</p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{T('legal.termsContent.youtubeTitle')}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{T('legal.termsContent.youtube')}</p>
          <a 
            href="https://www.youtube.com/t/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline hover:text-[var(--accent-hover)] block mt-4 transition-colors"
          >
            {T('legal.youtubeTos')}
          </a>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{T('common.details')}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{T('legal.termsContent.prohibited')}</p>
        </section>
      </div>
    </div>
  );
}
