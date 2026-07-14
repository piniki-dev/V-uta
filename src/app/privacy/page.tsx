import { translations } from '@/lib/translations';
import PrivacyContent from './PrivacyContent';

export function generateMetadata() {
  const t = translations['ja'];
  return {
    title: `${t.legal.privacy} | ${t.common.siteTitle}`,
    description: t.legal.privacyContent.intro,
  };
}

export default function PrivacyPage() {
  return <PrivacyContent />;
}
