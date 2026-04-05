import { Metadata } from 'next';
import ContactForm from './ContactForm';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import Hero from '@/components/Hero';
import { Mail } from 'lucide-react';
import JsonLd from '@/components/JsonLd';

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": t.sidebar.home,
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": t.contact.title,
        "item": `${baseUrl}/contact`
      }
    ]
  };

  return (
    <main className="min-h-screen pb-20">
      <JsonLd data={breadcrumbData} />
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
