import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';
import Hero from '@/components/Hero';
import { FileText } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.legal.terms} | ${t.common.siteTitle}`,
    description: t.legal.termsContent.intro,
  };
}

export default async function TermsPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return (
    <div className="min-h-screen pb-20">
      <Hero 
        title={t.legal.terms}
        description={t.legal.termsContent.intro}
        icon={<FileText size={48} />}
        centered
      />

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{t.legal.termsContent.title}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{t.legal.termsContent.intro}</p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{t.legal.termsContent.youtubeTitle}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{t.legal.termsContent.youtube}</p>
          <a 
            href="https://www.youtube.com/t/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline hover:text-[var(--accent-hover)] block mt-4 transition-colors"
          >
            {t.legal.youtubeTos}
          </a>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-5 font-heading">{t.common.details}</h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] break-words">{t.legal.termsContent.prohibited}</p>
        </section>
      </div>
    </div>
  );
}
