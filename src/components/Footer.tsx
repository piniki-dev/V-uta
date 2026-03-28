'use client';

import Link from 'next/link';
import { useLocale } from './LocaleProvider';

export default function Footer() {
  const { T } = useLocale();

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__top">
          <div className="footer__logo">
            <span className="footer__logo-text">V-uta</span>
          </div>
          <p className="footer__description">
            {T('home.description')}
          </p>
        </div>

        <div className="footer__divider" />

        <div className="footer__bottom">
          <div className="footer__copyright">
            {T('legal.copyright')}
          </div>
          
          <nav className="footer__nav">
            <Link href="/about" className="footer__link">{T('legal.about')}</Link>
            <Link href="/terms" className="footer__link">{T('legal.terms')}</Link>
            <Link href="/privacy" className="footer__link">{T('legal.privacy')}</Link>
          </nav>

          <div className="footer__attribution">
            <span className="footer__yt-text">{T('legal.poweredByYoutube')}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .footer {
          padding: 64px 0 32px;
          background: rgba(var(--bg-primary-rgb), 0.5);
          border-top: 1px solid var(--border);
          margin-top: auto;
        }

        .footer__inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .footer__top {
          max-width: 600px;
          margin-bottom: 40px;
        }

        .footer__logo {
          font-family: var(--font-heading);
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .footer__logo-text {
          background: linear-gradient(135deg, var(--accent), #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .footer__description {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .footer__divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--border), transparent);
          margin-bottom: 32px;
        }

        .footer__bottom {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        @media (min-width: 769px) {
          .footer__bottom {
            flex-direction: row;
            justify-content: space-between;
          }
        }

        .footer__copyright {
          font-size: 13px;
          color: var(--text-tertiary);
        }

        .footer__nav {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .footer__link {
          font-size: 13px;
          color: var(--text-secondary);
          transition: color var(--transition);
        }

        .footer__link:hover {
          color: var(--accent);
        }

        .footer__attribution {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .footer__yt-text {
          font-size: 12px;
          color: var(--text-tertiary);
          font-weight: 500;
          letter-spacing: 0.5px;
        }
      `}</style>
    </footer>
  );
}
