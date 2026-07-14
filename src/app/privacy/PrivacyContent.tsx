'use client';

import Hero from '@/components/Hero';
import { Shield } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import JsonLd from '@/components/JsonLd';

export default function PrivacyContent() {
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
        "name": T('legal.privacy'),
        "item": `${baseUrl}/privacy`
      }
    ]
  };

  return (
    <div className="min-h-screen pb-20">
      <JsonLd data={breadcrumbData} />
      <Hero 
        title={T('legal.privacy')}
        description={T('legal.privacyContent.intro')}
        icon={<Shield size={48} />}
        centered
      />

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{T('legal.privacyContent.youtubeTitle')}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{T('legal.privacyContent.youtubeApi')}</p>
          <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)] break-words">{T('legal.privacyContent.googleLink')}</p>
          <a 
            href="http://www.google.com/policies/privacy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline hover:text-[var(--accent-hover)] block mt-4 transition-colors"
          >
            {T('legal.googlePrivacy')}
          </a>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{T('legal.privacyContent.revocationTitle')}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{T('legal.privacyContent.revocation')}</p>
          <a 
            href="https://security.google.com/settings/security/permissions" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline hover:text-[var(--accent-hover)] block mt-4 transition-colors"
          >
            {T('legal.revokeAccess')}
          </a>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{T('legal.privacyContent.usageTitle')}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{T('legal.privacyContent.dataUsage')}</p>
        </section>
      </div>
    </div>
  );
}
