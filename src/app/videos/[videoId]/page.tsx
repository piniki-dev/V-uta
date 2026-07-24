import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Video, Song, Channel } from '@/types';
import ArchiveView from './ArchiveView';
import { translations } from '@/lib/translations';
import JsonLd from '@/components/JsonLd';
import { unstable_cache } from 'next/cache';
import { getVideosForStatic } from '@/app/songs/new/actions';

// unstable_cache でリクエスト間キャッシュ（手動パージで更新）
const getCachedVideoDetails = (videoId: string) =>
  unstable_cache(
    async () => {
      console.log('[unstable_cache] Fetching video details for:', videoId);
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
      );
    
      const { data: video } = await supabase
        .from('videos')
        .select('*')
        .eq('video_id', videoId)
        .single();

      if (!video) {
        return { video: null, songs: [], collaboratorChannels: [] };
      }

      // video_channels レコードから関連チャンネルを検索
      const { data: videoChanRecords } = await supabase
        .from('video_channels')
        .select('channel_id, is_original')
        .eq('video_id', video.id);

      let collaboratorChannels: (Channel & { isOriginal: boolean })[] = [];
      let originalChannel: Channel | null = null;

      if (videoChanRecords && videoChanRecords.length > 0) {
        const channelIds = videoChanRecords.map(r => r.channel_id);
        const originalMap = new Map<number, boolean>();
        videoChanRecords.forEach(r => originalMap.set(r.channel_id, r.is_original));

        const { data: chanData } = await supabase
          .from('channels')
          .select('*')
          .in('id', channelIds);

        if (chanData) {
          collaboratorChannels = chanData.map(c => ({
            ...(c as Channel),
            isOriginal: originalMap.get(c.id) ?? false
          }));

          const origChan = chanData.find(c => originalMap.get(c.id) === true);
          if (origChan) {
            originalChannel = origChan as Channel;
          }
        }
      }

      const { data: songsData } = await supabase
        .from('songs')
        .select('*, master_song:master_songs(*)')
        .eq('video_id', video.id)
        .eq('is_active', true)
        .order('start_sec', { ascending: true });

      let songs: Song[] = [];
      if (songsData && songsData.length > 0) {
        const songIds = songsData.map((s) => s.id);
        const { data: scData } = await supabase
          .from('song_channels')
          .select('song_id, channel:channels(*)')
          .in('song_id', songIds);

        const scMap = new Map<number, Channel[]>();
        if (scData) {
          for (const sc of scData) {
            const ch = sc.channel as unknown as Channel | null;
            if (!ch) continue;
            const list = scMap.get(sc.song_id) || [];
            list.push(ch);
            scMap.set(sc.song_id, list);
          }
        }

        songs = songsData.map((s) => ({
          ...(s as Song),
          singers: scMap.get(s.id) || [],
        }));
      }

      return {
        video: {
          ...video,
          channel: originalChannel,
        },
        songs,
        collaboratorChannels,
      };
    },
    ['video-details', videoId],
    {
      tags: ['video-details']
    }
  )();

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

  const locale = 'ja';
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  if (!video) return { title: t.archive.notFound };

  const songList = (songs || [])
    .map(s => s.master_song?.title)
    .filter(Boolean)
    .join(', ');
  
  const channelName = video.channel?.name || t.common.unknown;
  const description = songList 
    ? `${channelName}の歌枠・ライブアーカイブ。収録曲: ${songList.length > 100 ? songList.substring(0, 100) + '...' : songList} を連続再生・スキップして視聴できます。`
    : `${channelName}の歌枠・ライブアーカイブ。曲は登録されていません。`;

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
  
  const { video, songs, collaboratorChannels } = await getCachedVideoDetails(videoId);

  const locale = 'ja';
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
    ? `${channelName}の歌枠・ライブアーカイブ。収録曲: ${songListText.length > 100 ? songListText.substring(0, 100) + '...' : songListText} を連続再生・スキップして視聴できます。`
    : `${channelName}の歌枠・ライブアーカイブ。曲は登録されていません。`;

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
        collaboratorChannels={collaboratorChannels}
      />
    </>
  );
}
