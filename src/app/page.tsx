import Home from './Home';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.common.siteTitle} | ${t.home.title}`,
    description: t.home.description,
  };
}

export default async function HomePage() {
  return <Home />;
}
