import { getPlaylistDetail, getFavoritePlaylistDetail } from '../actions';
import PlaylistDetailClient from './PlaylistDetailClient';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  let result;
  if (idStr === 'favorite') {
    result = await getFavoritePlaylistDetail();
  } else {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return {};
    result = await getPlaylistDetail(id);
  }
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  if (!result.success || !result.data) return {};

  return {
    title: `${result.data.name} | ${t.playlist.metaTitle} | ${t.common.siteTitle}`,
    description: result.data.description || t.playlist.noDescription,
  };
}

export default async function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  
  let result;
  if (idStr === 'favorite') {
    result = await getFavoritePlaylistDetail();
  } else {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();
    result = await getPlaylistDetail(id);
  }

  if (!result.success || !result.data) {
    notFound();
  }

  return <PlaylistDetailClient playlist={result.data} />;
}
