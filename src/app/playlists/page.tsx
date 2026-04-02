import PlaylistsView from './PlaylistsView';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';
import { getPlaylists } from './actions';

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
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  const result = await getPlaylists();
  const playlists = result.success ? (result.data || []) : [];

  return <PlaylistsView playlists={playlists} t={t} />;
}
