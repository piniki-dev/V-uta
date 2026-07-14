'use client';

import Hero from '@/components/Hero';
import { Info, MessageCircle, Shield, FileText } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';
import JsonLd from '@/components/JsonLd';

export default function AboutContent() {
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
        "name": T('legal.about'),
        "item": `${baseUrl}/about`
      }
    ]
  };

  return (
    <div className="min-h-screen">
      <JsonLd data={breadcrumbData} />
      <Hero
        title={T('legal.about')}
        description={T('legal.aboutContent.description')}
        icon={<Info size={48} />}
        centered
      />

      <div className="container px-6 py-16 max-w-3xl mx-auto">
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-5 font-[var(--font-heading)] text-[var(--text-primary)]">
            {T('common.details')}
          </h2>
          <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)] break-words">
            {T('legal.aboutContent.disclaimer')}
          </p>
          <p className="mt-4 text-[16px] leading-[1.8] text-[var(--text-secondary)] break-words">
            {T('legal.poweredByYoutube')}
          </p>
        </section>

        <section className="mt-16 bg-gradient-to-br from-[var(--bg-secondary)] to-transparent border border-[var(--border)] rounded-3xl p-8 md:p-12">
          <h2 className="text-xl font-bold mb-8 flex items-center gap-3 text-[var(--text-primary)]">
            <Shield size={24} className="text-[var(--accent)]" />
            {T('legal.terms')} & {T('legal.privacy')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Link 
              href="/terms"
              className="flex items-center gap-4 p-6 bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-[var(--text-primary)]">{T('legal.terms')}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Terms of Service</div>
              </div>
            </Link>
            <Link 
              href="/privacy"
              className="flex items-center gap-4 p-6 bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                <Shield size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-[var(--text-primary)]">{T('legal.privacy')}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Privacy Policy</div>
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-16 bg-gradient-to-br from-[var(--accent)]/10 to-transparent border border-[var(--accent)]/20 text-center rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent)] to-indigo-500 opacity-50" />
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-2xl md:text-3xl font-bold m-0 text-[var(--text-primary)] font-[var(--font-heading)]">
              {T('legal.contact')}
            </h2>
            <p className="text-[var(--text-secondary)] mb-4 text-[16px] leading-[1.8] break-words">
              {T('contact.subtitle')}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-[var(--accent)] to-indigo-500 text-white font-black rounded-full transition-all duration-300 shadow-lg shadow-[var(--accent-glow)] hover:scale-105 hover:shadow-xl hover:shadow-[var(--accent-glow)] active:scale-95"
            >
              <MessageCircle size={20} className="mr-2" />
              {T('contact.title')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
