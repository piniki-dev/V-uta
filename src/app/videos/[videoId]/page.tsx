import { createClient } from '@/utils/supabase/server';
import type { Video, Song } from '@/types';
import ArchiveClient from './ArchiveClient';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  const { data: video } = await supabase
    .from('videos')
    .select('*, channels(*)')
    .eq('video_id', videoId)
    .single();

  if (!video) return { title: t.archive.notFound };

  return {
    title: `${video.title} | ${video.channels?.name || t.common.unknown} | ${t.common.siteTitle}`,
    description: video.description,
  };
}

interface Props {
  params: Promise<{ videoId: string }>;
}

export default async function ArchivePage({ params }: Props) {
  const { videoId } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  // 動画取得 (video_id = YouTube ID)
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*, channels(*)')
    .eq('video_id', videoId)
    .single();

  if (videoError || !video) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h1 className="empty-state__title">{t.archive.notFound}</h1>
          <p className="empty-state__text">
            {t.archive.notFoundText}
          </p>
          <a href="/songs/new" className="btn btn--primary">
            {t.archive.registerSong}
          </a>
        </div>
      </div>
    );
  }

  // 曲リスト取得 (master_songsをJOIN)
  const { data: songs } = await supabase
    .from('songs')
    .select('*, master_songs(*)')
    .eq('video_id', video.id)
    .eq('is_active', true)
    .order('start_sec', { ascending: true });

  return (
    <ArchiveClient
      video={video as Video}
      songs={(songs || []) as Song[]}
    />
  );
}
