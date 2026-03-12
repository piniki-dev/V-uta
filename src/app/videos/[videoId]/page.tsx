import { createClient } from '@/utils/supabase/server';
import type { Video, Song } from '@/types';
import ArchiveClient from './ArchiveClient';

interface Props {
  params: Promise<{ videoId: string }>;
}

export default async function ArchivePage({ params }: Props) {
  const { videoId } = await params;
  const supabase = await createClient();

  // 動画取得 (video_id = YouTube ID)
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*')
    .eq('video_id', videoId)
    .single();

  if (videoError || !video) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h1 className="empty-state__title">アーカイブが見つかりません</h1>
          <p className="empty-state__text">
            このアーカイブはまだ登録されていないか、URLが正しくありません。
          </p>
          <a href="/songs/new" className="btn btn--primary">
            歌を登録する
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
