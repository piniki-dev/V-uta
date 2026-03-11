import { createClient } from '@/utils/supabase/server';
import NewSongClient from './NewSongClient';
import { Lock } from 'lucide-react';

export const metadata = {
  title: '歌を登録 | V-uta',
};

export default async function NewSongPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h1 className="page-title">歌を登録</h1>
        <div className="card" style={{ padding: '3rem 2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', color: 'var(--accent)' }}>
            <Lock size={48} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            ログインが必要です
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            歌を登録するには、Google アカウントでのログインが必要です。<br />
            画面右上の「Google でログイン」ボタンからログインしてください。
          </p>
        </div>
      </div>
    );
  }

  return <NewSongClient />;
}
