import type { Video, Song } from '@/types';
import ArchiveHeader from './ArchiveHeader';
import ArchiveSongList from './ArchiveSongList';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import Link from 'next/link';

interface Props {
  video: Video;
  songs: Song[];
}

export default async function ArchiveView({ video, songs }: Props) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return (
    <div className="page-container">
      {/* 動画情報ヘッダー (Client Component for animations and play logic) */}
      <ArchiveHeader video={video} songs={songs} />

      {/* 曲リスト (ArchiveSongList provides its own mapping logic) */}
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
