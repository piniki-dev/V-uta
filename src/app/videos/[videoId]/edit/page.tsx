import { createClient } from '@/utils/supabase/server';
import type { Video, Song } from '@/types';
import { redirect } from 'next/navigation';
import EditSongsClient from './EditSongsClient';

interface Props {
  params: Promise<{ videoId: string }>;
}

export default async function EditSongsPage({ params }: Props) {
  const { videoId } = await params;
  const supabase = await createClient();

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/videos/${videoId}`);
  }

  // 動画取得
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
    <EditSongsClient
      video={video as Video}
      songs={(songs || []) as Song[]}
    />
  );
}
