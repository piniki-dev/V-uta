import { createClient } from '@/utils/supabase/server';
import type { Video, Song } from '@/types';
import ArchiveView from './ArchiveView';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata({ 
  params,
  searchParams
}: { 
  params: Promise<{ videoId: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { videoId } = await params;
  const sParams = await searchParams;
  const track = typeof sParams.track === 'string' ? sParams.track : null;

  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  const { data: video } = await supabase
    .from('videos')
    .select('*, channels(*)')
    .eq('video_id', videoId)
    .single();

  if (!video) return { title: t.archive.notFound };

  const ogUrl = track ? `${baseUrl}/videos/${videoId}/og?track=${track}` : `${baseUrl}/videos/${videoId}/og`;

  return {
    title: `${video.title} | ${video.channels?.name || t.common.unknown} | ${t.common.siteTitle}`,
    description: video.description,
    openGraph: {
      images: [ogUrl],
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogUrl],
    }
  };
}

interface Props {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ArchivePage({ params, searchParams }: Props) {
  const { videoId } = await params;
  const sParams = await searchParams;
  const songId = typeof sParams.songId === 'string' ? sParams.songId : null;
  
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  // 動画取得 (video_id = YouTube ID)
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*, channels(*)').eq('video_id', videoId).single();

  if (videoError || !video) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h1 className="empty-state__title">{t.archive.notFound}</h1>
          <p className="empty-state__text">{t.archive.notFoundText}</p>
          <a href="/songs/new" className="btn btn--primary">{t.archive.registerSong}</a>
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

  const typedVideo = video as Video;
  const typedSongs = (songs || []) as Song[];

  // track パラメータ (1-indexed) から songId を特定
  const trackNum = typeof sParams.track === 'string' ? parseInt(sParams.track) : null;
  let resolvedSongId = songId;
  if (!resolvedSongId && trackNum && typedSongs[trackNum - 1]) {
    resolvedSongId = typedSongs[trackNum - 1].id.toString();
  }

  // JSON-LD MusicVideo data
  const videoData = {
    "@context": "https://schema.org",
    "@type": "MusicVideo",
    "name": typedVideo.title,
    "description": typedVideo.description,
    "thumbnailUrl": `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    "uploadDate": typedVideo.published_at || typedVideo.created_at,
    "url": `${baseUrl}/videos/${videoId}`,
    "embedUrl": `https://www.youtube.com/embed/${videoId}`,
    "duration": typedVideo.duration ? `PT${typedVideo.duration}S` : undefined,
    "creator": {
      "@type": "MusicGroup",
      "name": typedVideo.channels?.name || "Unknown VTuber"
    },
    // Chapers (HasPart)
    "hasPart": typedSongs.map((song, i) => ({
      "@type": "Clip",
      "name": song.master_songs?.title || "Unknown Song",
      "startOffset": song.start_sec,
      "endOffset": song.end_sec,
      "url": `${baseUrl}/videos/${videoId}?track=${i + 1}`
    }))
  };

  return (
    <>
      <JsonLd data={videoData} />
      <ArchiveView
        video={typedVideo}
        songs={typedSongs}
        songId={resolvedSongId}
      />
    </>
  );
}
