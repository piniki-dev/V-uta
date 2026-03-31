import { Metadata } from 'next';
import ContactClient from './ContactClient';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: t.contact.title,
    description: t.contact.subtitle,
  };
}

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <ContactClient />
    </main>
  );
}
