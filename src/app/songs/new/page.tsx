import { createClient } from '@/utils/supabase/server';
import NewSongClient from './NewSongClient';
import { Lock } from 'lucide-react';

import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.newSong.title} | ${t.common.siteTitle}`,
    description: t.newSong.description,
  };
}

export default async function NewSongPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const cookieStore = await cookies();
    const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
    const t = translations[locale];

    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col pt-20">
        <div className="container px-6 max-w-4xl mx-auto">
          <header className="mb-12 text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl font-black mb-6 tracking-tight text-[var(--text-primary)] glow-text">
              {t.newSong.title}
            </h1>
          </header>

          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[40px] p-12 md:p-20 text-center relative overflow-hidden group shadow-2xl">
            {/* 装飾的な背景グロー */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[var(--accent)]/10 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            
            <div className="relative z-10 flex flex-col items-center gap-8">
              <div className="w-24 h-24 bg-[var(--accent-subtle)] text-[var(--accent)] rounded-3xl flex items-center justify-center shadow-inner border border-[var(--accent)]/20 animate-pulse">
                <Lock size={48} strokeWidth={1.5} />
              </div>
              
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                  {t.newSong.loginRequired}
                </h2>
                <p className="text-[var(--text-secondary)] text-lg font-medium leading-relaxed max-w-lg mx-auto">
                  {t.newSong.loginDescription}<br />
                  <span className="text-[var(--text-tertiary)] text-base">
                    {t.newSong.loginInstruction}
                  </span>
                </p>
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent my-4" />
              
              <p className="text-sm font-black text-[var(--accent)] uppercase tracking-widest bg-[var(--accent-subtle)] px-6 py-2 rounded-full border border-[var(--accent)]/30">
                Secure Access Only
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <NewSongClient />;
}
