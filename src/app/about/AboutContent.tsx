'use client';

import Hero from '@/components/Hero';
import { Info, MessageCircle, Shield, FileText, User, Heart, ExternalLink } from 'lucide-react';
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

        {/* 開発・運営者情報セクション */}
        <section className="mt-16 bg-gradient-to-br from-[var(--bg-secondary)] to-transparent border border-[var(--border)] rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
              <User size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] leading-tight">
                {T('legal.aboutContent.developerTitle')}
              </h2>
              <span className="text-xs text-[var(--text-tertiary)] font-medium">
                {T('legal.aboutContent.developerRole')}
              </span>
            </div>
          </div>

          <div className="bg-[var(--bg-tertiary)]/40 border border-[var(--border)] rounded-2xl p-6 md:p-8 mb-8">
            <div className="font-bold text-[var(--text-primary)] text-lg mb-2 flex items-center gap-2">
              <Heart size={18} className="text-rose-500 fill-rose-500/20" />
              {T('legal.aboutContent.developerName')}
            </div>
            <h3 className="text-base font-bold text-[var(--accent)] mb-3">
              {T('legal.aboutContent.developerMessageTitle')}
            </h3>
            <p className="text-[15px] leading-[1.8] text-[var(--text-secondary)] break-words m-0">
              {T('legal.aboutContent.developerMessage')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://x.com/piniki_dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] font-bold text-sm rounded-xl border border-[var(--border)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current text-[var(--text-primary)]" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>{T('legal.aboutContent.officialX')}</span>
              <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
            </a>
            <a
              href="https://github.com/piniki-dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] font-bold text-sm rounded-xl border border-[var(--border)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current text-[var(--text-primary)]" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>{T('legal.aboutContent.github')}</span>
              <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
            </a>
          </div>
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

