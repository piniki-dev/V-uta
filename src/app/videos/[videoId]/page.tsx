import { createClient } from '@/utils/supabase/server';
import type { Video, Song } from '@/types';
import ArchiveView from './ArchiveView';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import JsonLd from '@/components/JsonLd';
import { cache } from 'react';
import { getVideosForStatic } from '@/app/songs/new/actions';

// 同一リクエスト内でのデータ取得をキャッシュ（重複排除）
const getCachedVideoDetails = cache(async (videoId: string) => {
  console.log('getCachedVideoDetails called for videoId:', videoId);
  const supabase = await createClient();
  
  const { data: video } = await supabase
    .from('videos')
    .select('*, channel:channels(*)')
    .eq('video_id', videoId)
    .single();

  if (!video) {
    return { video: null, songs: [] };
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('*, master_song:master_songs(*)')
    .eq('video_id', video.id)
    .eq('is_active', true)
    .order('start_sec', { ascending: true });

  return { video, songs: songs || [] };
});

export async function generateStaticParams() {
  const result = await getVideosForStatic();
  if (!result.success || !result.data) {
    return [];
  }
  return result.data.map((video) => ({
    videoId: video.video_id,
  }));
}

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

  const { video, songs } = await getCachedVideoDetails(videoId);

  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  if (!video) return { title: t.archive.notFound };

  const songList = (songs || [])
    .map(s => s.master_song?.title)
    .filter(Boolean)
    .join(', ');
  
  const channelName = video.channel?.name || t.common.unknown;
  const description = songList 
    ? (locale === 'ja' 
        ? `${channelName}の歌枠・ライブアーカイブ。収録曲: ${songList.length > 100 ? songList.substring(0, 100) + '...' : songList} を連続再生・スキップして視聴できます。`
        : `Karaoke archive by ${channelName}. Setlist: ${songList.length > 100 ? songList.substring(0, 100) + '...' : songList}. Play and skip through songs.`)
    : (locale === 'ja'
        ? `${channelName}の歌枠・ライブアーカイブ。曲は登録されていません。`
        : `Karaoke archive by ${channelName}. No songs registered yet.`);

  const ogUrl = track ? `${baseUrl}/videos/${videoId}/og?track=${track}` : `${baseUrl}/videos/${videoId}/og`;

  return {
    title: `${video.title} | ${channelName} | ${t.common.siteTitle}`,
    description,
    openGraph: {
      images: [ogUrl],
      description,
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogUrl],
      description,
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
  
  const { video, songs } = await getCachedVideoDetails(videoId);

  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  if (!video) {
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

  const typedVideo = video as Video;
  const typedSongs = (songs || []) as Song[];

  const songListText = typedSongs
    .map(s => s.master_song?.title)
    .filter(Boolean)
    .join(', ');

  const channelName = typedVideo.channel?.name || "Unknown VTuber";
  const songDescription = songListText
    ? (locale === 'ja'
        ? `${channelName}の歌枠・ライブアーカイブ。収録曲: ${songListText.length > 100 ? songListText.substring(0, 100) + '...' : songListText} を連続再生・スキップして視聴できます。`
        : `Karaoke archive by ${channelName}. Setlist: ${songListText.length > 100 ? songListText.substring(0, 100) + '...' : songListText}. Play and skip through songs.`)
    : (locale === 'ja'
        ? `${channelName}の歌枠・ライブアーカイブ。曲は登録されていません。`
        : `Karaoke archive by ${channelName}. No songs registered yet.`);

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
    "description": songDescription,
    "thumbnailUrl": `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    "uploadDate": typedVideo.published_at || typedVideo.created_at,
    "url": `${baseUrl}/videos/${videoId}`,
    "embedUrl": `https://www.youtube.com/embed/${videoId}`,
    "duration": typedVideo.duration ? `PT${typedVideo.duration}S` : undefined,
    "creator": {
      "@type": "MusicGroup",
      "name": channelName
    },
    // Chapers (HasPart)
    "hasPart": typedSongs.map((song, i) => ({
      "@type": "Clip",
      "name": song.master_song?.title || "Unknown Song",
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
