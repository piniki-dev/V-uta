'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useSidebar } from './SidebarContext';

export default function HeaderToggle() {
  const { toggle } = useSidebar();

  return (
    <div className="header__left">
      <button 
        className="header__menu-toggle" 
        onClick={toggle}
        aria-label="メニューを切替"
      >
        <Menu size={24} />
      </button>
      <Link href="/" className="header__logo font-black">
        <span className="header__logo-icon">♪</span>
        <span className="header__logo-text tracking-tighter">V-uta</span>
      </Link>
      <style jsx>{`
        .header__left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header__menu-toggle {
          padding: 8px;
          margin-left: 0;
          color: var(--text-secondary);
          transition: var(--transition);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header__menu-toggle:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }

        .header__logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 24px;
          letter-spacing: -1.2px;
          font-weight: 900;
        }

        .header__logo-icon {
          color: var(--accent);
          font-size: 26px;
        }

        .header__logo-text {
          background: linear-gradient(135deg, var(--accent), #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </div>
  );
}
