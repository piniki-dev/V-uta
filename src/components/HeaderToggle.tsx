'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { useHeader } from './HeaderProvider';

export default function HeaderToggle() {
  const { toggle } = useSidebar();
  const { isMobileSearchActive } = useHeader();

  return (
    <div className={`flex items-center gap-5 ${isMobileSearchActive ? 'max-sm:hidden' : ''}`}>
      <button 
        className="header__menu-toggle" 
        onClick={toggle}
        aria-label="メニューを切替"
      >
        <Menu size={24} />
      </button>
      <Link href="/" className="header__logo font-black">
        <img src="/icon.svg" alt="V-uta" className="header__logo-img" />
        <span className="header__logo-text tracking-tighter">V-uta</span>
      </Link>
      <style jsx>{`
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
          gap: 12px;
          font-family: var(--font-display);
          font-size: 24px;
          letter-spacing: -0.5px;
          font-weight: 800;
        }

        .header__logo-img {
          width: 32px;
          height: 32px;
          object-fit: contain;
          border-radius: 8px;
        }

        .header__logo-text {
          background: linear-gradient(135deg, #fff, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}
