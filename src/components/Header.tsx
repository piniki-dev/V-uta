import Link from 'next/link';
import { Home, PlusSquare, ListMusic } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import AuthButton from './AuthButton';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="header">
      <div className="header__inner">
        <Link href="/" className="header__logo">
          <span className="header__logo-icon">♪</span>
          <span className="header__logo-text">V-uta</span>
        </Link>

        <nav className="header__nav">
          <Link href="/" className="header__nav-link">
            <Home size={20} />
            ホーム
          </Link>
          <Link href="/playlists" className="header__nav-link">
            <ListMusic size={20} />
            プレイリスト
          </Link>
          <Link href="/songs/new" className="header__nav-link">
            <PlusSquare size={20} />
            歌を登録
          </Link>
        </nav>

        <div className="header__actions">
          <AuthButton user={user} />
        </div>
      </div>
    </header>
  );
}
