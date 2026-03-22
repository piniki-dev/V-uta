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
      <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h1 className="page-title">{t.newSong.title}</h1>
        <div className="card" style={{ padding: '3rem 2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', color: 'var(--accent)' }}>
            <Lock size={48} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {t.newSong.loginRequired}
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {t.newSong.loginDescription}<br />
            {t.newSong.loginInstruction}
          </p>
        </div>
      </div>
    );
  }

  return <NewSongClient />;
}
