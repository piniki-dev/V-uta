import Link from 'next/link';

export default function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <Link href="/" className="header__logo">
          <span className="header__logo-icon">♪</span>
          <span className="header__logo-text">V-uta</span>
        </Link>

        <nav className="header__nav">
          <Link href="/" className="header__nav-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            ホーム
          </Link>
          <Link href="/songs/new" className="header__nav-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            歌を登録
          </Link>
        </nav>
      </div>
    </header>
  );
}
