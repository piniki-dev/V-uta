-- videos テーブル: YouTube 歌枠アーカイブの動画情報
CREATE TABLE public.videos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  video_id text NOT NULL UNIQUE,
  title text NOT NULL,
  channel_id text,
  channel_name text,
  thumbnail_url text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- songs テーブル: 各アーカイブ内の個別歌唱区間
CREATE TABLE public.songs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  video_id bigint NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text,
  start_sec integer NOT NULL,
  end_sec integer NOT NULL,
  created_by uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (start_sec < end_sec),
  CONSTRAINT min_duration CHECK (end_sec - start_sec >= 10)
);

-- RLS 有効化
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- ステップ1: 匿名アクセス可 (認証追加時に変更)
CREATE POLICY "videos_select_all" ON public.videos FOR SELECT USING (true);
CREATE POLICY "videos_insert_all" ON public.videos FOR INSERT WITH CHECK (true);
CREATE POLICY "songs_select_all" ON public.songs FOR SELECT USING (true);
CREATE POLICY "songs_insert_all" ON public.songs FOR INSERT WITH CHECK (true);

-- パフォーマンス用インデックス
CREATE INDEX idx_songs_video_id ON public.songs(video_id);
CREATE INDEX idx_videos_video_id ON public.videos(video_id);
