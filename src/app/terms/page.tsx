import { translations } from '@/lib/translations';
import TermsContent from './TermsContent';

export function generateMetadata() {
  const t = translations['ja'];
  return {
    title: `${t.legal.terms} | ${t.common.siteTitle}`,
    description: t.legal.termsContent.intro,
  };
}

export default function TermsPage() {
  return <TermsContent />;
}
