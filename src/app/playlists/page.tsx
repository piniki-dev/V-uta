import PlaylistsClient from './PlaylistsClient';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.playlist.metaTitle} | ${t.common.siteTitle}`,
    description: t.playlist.metaDescription,
  };
}

export default async function PlaylistsPage() {
  return <PlaylistsClient />;
}
