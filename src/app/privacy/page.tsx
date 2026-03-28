'use client';

import Hero from '@/components/Hero';
import { useLocale } from '@/components/LocaleProvider';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  const { T } = useLocale();

  return (
    <div className="legal-page">
      <Hero 
        title={T('legal.privacy')}
        description={T('legal.privacyContent.intro')}
        icon={<Shield size={48} />}
        centered
      />

      <div className="container page-content">
        <section className="legal-section">
          <h2>YouTube Services</h2>
          <p>{T('legal.privacyContent.youtubeApi')}</p>
          <p className="mt-4">{T('legal.privacyContent.googleLink')}</p>
          <a 
            href="http://www.google.com/policies/privacy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-accent underline hover:text-accent-hover block mt-4"
          >
            {T('legal.googlePrivacy')}
          </a>
        </section>

        <section className="legal-section">
          <h2>Data Access Revocation</h2>
          <p>{T('legal.privacyContent.revocation')}</p>
          <a 
            href="https://security.google.com/settings/security/permissions" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-accent underline hover:text-accent-hover block mt-4"
          >
            {T('legal.revokeAccess')}
          </a>
        </section>

        <section className="legal-section">
          <h2>Data Usage</h2>
          <p>{T('legal.privacyContent.dataUsage')}</p>
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
