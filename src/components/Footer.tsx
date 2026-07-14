'use client';

import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';
import './Footer.css';

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
            <Link href="/contact" className="footer__link">{T('legal.contact')}</Link>
            <Link href="/terms" className="footer__link">{T('legal.terms')}</Link>
            <Link href="/privacy" className="footer__link">{T('legal.privacy')}</Link>
          </nav>

          <div className="footer__attribution">
            <span className="footer__yt-text">{T('legal.poweredByYoutube')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
