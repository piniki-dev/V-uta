import { translations } from '@/lib/translations';
import AboutContent from './AboutContent';

export function generateMetadata() {
  const t = translations['ja'];
  return {
    title: `${t.legal.about} | ${t.common.siteTitle}`,
    description: t.legal.aboutContent.description,
  };
}

export default function AboutPage() {
  return <AboutContent />;
}
