import { translations } from '@/lib/translations';
import ContactContent from './ContactContent';

export function generateMetadata() {
  const t = translations['ja'];
  return {
    title: `${t.contact.title} | ${t.common.siteTitle}`,
    description: t.contact.subtitle,
  };
}

export default function ContactPage() {
  return <ContactContent />;
}
