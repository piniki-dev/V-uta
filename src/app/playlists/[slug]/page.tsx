import { getPlaylistDetail, getFavoritePlaylistDetail } from '../actions';
import PlaylistDetailContent from './PlaylistDetailContent';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let result;
  if (slug === 'favorite') {
    result = await getFavoritePlaylistDetail();
  } else {
    result = await getPlaylistDetail(slug);
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

export default async function PlaylistDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  let result;
  if (slug === 'favorite') {
    result = await getFavoritePlaylistDetail();
  } else {
    result = await getPlaylistDetail(slug);
  }

  if (!result.success || !result.data) {
    notFound();
  }

  return <PlaylistDetailContent playlist={result.data} />;
}
