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
      <EditSongsClient
        video={null}
        songs={[]}
        error={videoError?.message || null}
      />
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
