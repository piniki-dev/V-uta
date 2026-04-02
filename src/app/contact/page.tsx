import { Metadata } from 'next';
import ContactForm from './ContactForm';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import Hero from '@/components/Hero';
import { Mail } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.contact.title} | ${t.common.siteTitle}`,
    description: t.contact.subtitle,
  };
}

export default async function ContactPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return (
    <main className="min-h-screen pb-20">
      <Hero 
        title={t.contact.title}
        description={t.contact.subtitle}
        icon={<Mail size={48} />}
        centered
      />
      
      {/* フォーム本体 (Client Component) */}
      <ContactForm />
    </main>
  );
}
