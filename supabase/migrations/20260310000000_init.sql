-- ==========================================
-- V-uta Database Schema (Consolidated)
-- ==========================================

-- 1. productions (所属事務所)
CREATE TABLE public.productions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  link text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- 2. vtubers
CREATE TABLE public.vtubers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  production_id bigint REFERENCES public.productions(id) ON DELETE SET NULL,
  name text NOT NULL,
  gender text CHECK (gender IN ('男性', '女性', 'その他', '不明')),
  link text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- 3. channels (YouTube チャンネル)
CREATE TABLE public.channels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vtuber_id bigint REFERENCES public.vtubers(id) ON DELETE CASCADE,
  yt_channel_id text NOT NULL UNIQUE, -- YouTube 固有の ID (UC...)
  name text NOT NULL,
  handle text,
  image text,
  description text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- 4. videos (アーカイブ動画)
CREATE TABLE public.videos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_record_id bigint REFERENCES public.channels(id) ON DELETE SET NULL,
  video_id text NOT NULL UNIQUE, -- YouTube Video ID
  title text NOT NULL,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration integer, -- 秒数
  is_stream boolean DEFAULT true,
  is_publish boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- 5. master_songs (原曲メタデータ)
CREATE TABLE public.master_songs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  artist text NOT NULL,
  duration_sec integer,
  artwork_url text,
  itunes_id text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_song_title_artist UNIQUE (title, artist)
);

-- 6. songs (動画内の歌唱区間)
CREATE TABLE public.songs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  video_id bigint NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  master_song_id bigint REFERENCES public.master_songs(id) ON DELETE SET NULL,
  start_sec integer NOT NULL,
  end_sec integer NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (start_sec < end_sec),
  CONSTRAINT min_duration CHECK (end_sec - start_sec >= 10)
);

-- 7. songs_history (歌唱区間の変更履歴)
CREATE TABLE public.songs_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  song_id bigint NOT NULL,
  video_id bigint,
  master_song_id bigint,
  start_sec integer,
  end_sec integer,
  is_active boolean,
  action text NOT NULL, -- 'UPDATE' or 'DELETE'
  changed_by uuid,
  changed_at timestamptz DEFAULT now()
);

-- 8. playlists (プレイリスト本体)
CREATE TABLE public.playlists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- 9. playlist_items (プレイリスト内の楽曲)
CREATE TABLE public.playlist_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  playlist_id bigint NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id bigint NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position integer NOT NULL,
  added_at timestamptz DEFAULT now()
);

-- ==========================================
-- Functions & Triggers
-- ==========================================

-- updated_at 自動更新関数
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- songs 変更履歴保存関数
CREATE OR REPLACE FUNCTION public.handle_song_history()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.songs_history (song_id, video_id, master_song_id, start_sec, end_sec, is_active, action, changed_by)
    VALUES (OLD.id, OLD.video_id, OLD.master_song_id, OLD.start_sec, OLD.end_sec, OLD.is_active, 'DELETE', auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- 値が実際に変更された場合のみ履歴を保存
    IF (OLD.video_id IS DISTINCT FROM NEW.video_id OR
        OLD.master_song_id IS DISTINCT FROM NEW.master_song_id OR
        OLD.start_sec IS DISTINCT FROM NEW.start_sec OR
        OLD.end_sec IS DISTINCT FROM NEW.end_sec OR
        OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
      INSERT INTO public.songs_history (song_id, video_id, master_song_id, start_sec, end_sec, is_active, action, changed_by)
      VALUES (OLD.id, OLD.video_id, OLD.master_song_id, OLD.start_sec, OLD.end_sec, OLD.is_active, 'UPDATE', auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- トリガーの設定
CREATE TRIGGER trigger_productions_updated_at BEFORE UPDATE ON public.productions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_vtubers_updated_at BEFORE UPDATE ON public.vtubers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_master_songs_updated_at BEFORE UPDATE ON public.master_songs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_songs_history
  AFTER UPDATE OR DELETE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.handle_song_history();

CREATE TRIGGER trigger_playlists_updated_at BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vtubers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

-- 1. productions: 参照全公開、登録はログイン要、更新削除不可
CREATE POLICY "productions_select_all" ON public.productions FOR SELECT USING (true);
CREATE POLICY "productions_insert_auth" ON public.productions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. vtubers: 参照全公開、登録はログイン要、更新削除不可
CREATE POLICY "vtubers_select_all" ON public.vtubers FOR SELECT USING (true);
CREATE POLICY "vtubers_insert_auth" ON public.vtubers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. channels: 参照全公開、登録はログイン要、更新削除不可
CREATE POLICY "channels_select_all" ON public.channels FOR SELECT USING (true);
CREATE POLICY "channels_insert_auth" ON public.channels FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. videos: 参照全公開、登録はログイン要、更新削除不可
CREATE POLICY "videos_select_all" ON public.videos FOR SELECT USING (true);
CREATE POLICY "videos_insert_auth" ON public.videos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. master_songs: 参照全公開、登録はログイン要、更新削除不可
CREATE POLICY "master_songs_select_all" ON public.master_songs FOR SELECT USING (true);
CREATE POLICY "master_songs_insert_auth" ON public.master_songs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. songs: 参照全公開、変更はログイン要（登録・更新・削除可）
CREATE POLICY "songs_select_all" ON public.songs FOR SELECT USING (true);
CREATE POLICY "songs_mutations_auth" ON public.songs FOR ALL USING (auth.uid() IS NOT NULL);

-- 7. songs_history: 参照・挿入はログイン要
CREATE POLICY "songs_history_select_auth" ON public.songs_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "songs_history_insert_auth" ON public.songs_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8. playlists
-- 公開プレイリストまたは自分のプレイリストを参照可能
CREATE POLICY "playlists_select_policy" ON public.playlists FOR SELECT USING (is_public = true OR auth.uid() = created_by);
-- 登録はログイン要
CREATE POLICY "playlists_insert_policy" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = created_by);
-- 更新・削除は作成者のみ
CREATE POLICY "playlists_update_policy" ON public.playlists FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "playlists_delete_policy" ON public.playlists FOR DELETE USING (auth.uid() = created_by);

-- 9. playlist_items
-- 親プレイリストが参照可能なら参照可能
CREATE POLICY "playlist_items_select_policy" ON public.playlist_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND (is_public = true OR auth.uid() = created_by)
  )
);
-- 作成者のみ変更可能
CREATE POLICY "playlist_items_modify_policy" ON public.playlist_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND auth.uid() = created_by
  )
);

-- ==========================================
-- Indexes
-- ==========================================

CREATE INDEX idx_vtubers_production_id ON public.vtubers(production_id);
CREATE INDEX idx_channels_vtuber_id ON public.channels(vtuber_id);
CREATE INDEX idx_channels_yt_channel_id ON public.channels(yt_channel_id);
CREATE INDEX idx_videos_channel_record_id ON public.videos(channel_record_id);
CREATE INDEX idx_videos_video_id ON public.videos(video_id);
CREATE INDEX idx_master_songs_title ON public.master_songs(title);
CREATE INDEX idx_songs_video_id ON public.songs(video_id);
CREATE INDEX idx_songs_master_song_id ON public.songs(master_song_id);
CREATE INDEX idx_songs_history_song_id ON public.songs_history(song_id);
CREATE INDEX idx_playlists_created_by ON public.playlists(created_by);
CREATE INDEX idx_playlist_items_playlist_id ON public.playlist_items(playlist_id);
CREATE INDEX idx_playlist_items_song_id ON public.playlist_items(song_id);


