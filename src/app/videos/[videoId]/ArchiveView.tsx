import type { Video, Song } from '@/types';
import ArchiveHeader from './ArchiveHeader';
import ArchiveSongList from './ArchiveSongList';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import Link from 'next/link';
import AutoPlayHandler from '@/components/player/AutoPlayHandler';

interface Props {
  video: Video;
  songs: Song[];
  songId?: string | null;
}

export default async function ArchiveView({ video, songs, songId }: Props) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return (
    <div className="page-container">
      {/* 共有リンクからの自動再生をハンドリング */}
      <AutoPlayHandler 
        songId={songId} 
        video={video} 
        songs={songs} 
      />

      {/* 動画情報ヘッダー */}
      <ArchiveHeader video={video} songs={songs} />

      {/* 曲リスト */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
        {songs.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__text">
              {t.archive.noSongs}
            </p>
            <Link href="/songs/new" className="btn btn--primary">
              {t.archive.registerSong}
            </Link>
          </div>
        ) : (
          <ArchiveSongList video={video} songs={songs} />
        )}
      </div>
    </div>
  );
}
