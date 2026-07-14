'use client';

import Hero from '@/components/Hero';
import { Mail } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import JsonLd from '@/components/JsonLd';
import ContactForm from './ContactForm';

export default function ContactContent() {
  const { T } = useLocale();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": T('sidebar.home'),
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": T('contact.title'),
        "item": `${baseUrl}/contact`
      }
    ]
  };

  return (
    <div className="min-h-screen pb-20">
      <JsonLd data={breadcrumbData} />
      <Hero 
        title={T('contact.title')}
        description={T('contact.subtitle')}
        icon={<Mail size={48} />}
        centered
      />
      
      {/* フォーム本体 (Client Component) */}
      <ContactForm />
    </div>
  );
}
