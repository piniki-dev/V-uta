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
  title_en text,
  artist_en text,
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
  updated_at timestamptz DEFAULT now(),
  is_favorites boolean DEFAULT false, -- お気に入りプレイリストフラグ
  slug text NOT NULL UNIQUE -- 外部公開用ID
);

-- ユーザーごとに最大1つのお気に入りプレイリストを保証
CREATE UNIQUE INDEX unique_favorite_playlist ON public.playlists (created_by) WHERE (is_favorites = true);

-- 9. playlist_items (プレイリスト内の楽曲)
CREATE TABLE public.playlist_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  playlist_id bigint NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id bigint NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position integer NOT NULL,
  added_at timestamptz DEFAULT now()
);

-- 10. play_history (再生履歴 - おすすめ機能の基盤)
CREATE TABLE public.play_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- ログインユーザーのみ（ゲストは保存しない）
  song_id bigint NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  played_at timestamptz DEFAULT now(),
  play_duration integer, -- 秒数（どこまで聴いたか：リコメンデーションに重要）
  source_type text, -- 'playlist', 'channel', 'search', 'direct' など
  source_id text, -- playlist_id など
  last_position integer DEFAULT 0,
  completion_rate numeric(5,4) DEFAULT 0,
  is_completed boolean DEFAULT false,
  meta_data jsonb -- 将来的な拡張性のため
);

-- 11. inquiries (お問い合わせ・フィードバック)
CREATE TABLE public.inquiries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- ログインユーザーの場合
  name text,
  email text,
  category text CHECK (category IN ('bug', 'feedback', 'other')),
  message text NOT NULL,
  image_url text, -- 画像添付用
  status text DEFAULT 'open' CHECK (status IN ('open', 'close')),
  created_at timestamptz DEFAULT now()
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

-- お気に入りプレイリストの自動作成関数
CREATE OR REPLACE FUNCTION public.handle_new_user_favorites()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.playlists (name, description, is_favorites, created_by, is_public, slug)
  VALUES ('お気に入りした曲', 'お気に入りした楽曲がここに表示されます', true, NEW.id, false, 'favorite');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 削除防止関数
CREATE OR REPLACE FUNCTION public.prevent_favorite_playlist_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_favorites = true THEN
    RAISE EXCEPTION 'お気に入りプレイリストは削除できません。';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_favorites();

CREATE TRIGGER trigger_prevent_favorite_playlist_deletion
  BEFORE DELETE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_favorite_playlist_deletion();

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
ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

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

-- 10. play_history: 自分の履歴のみ参照・追加・削除可能
CREATE POLICY "play_history_all_policy" ON public.play_history FOR ALL USING (auth.uid() = user_id);

-- 11. inquiries: 誰でも追加可能、参照は制限（ダッシュボード等で確認）
CREATE POLICY "inquiries_insert_all" ON public.inquiries FOR INSERT WITH CHECK (true);

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

CREATE INDEX idx_play_history_user_id ON public.play_history(user_id);
CREATE INDEX idx_play_history_song_id ON public.play_history(song_id);
CREATE INDEX idx_play_history_played_at ON public.play_history(played_at);

CREATE INDEX idx_inquiries_user_id ON public.inquiries(user_id);
CREATE INDEX idx_inquiries_created_at ON public.inquiries(created_at);

-- ==========================================
-- Storage Settings
-- ==========================================

-- バケットの作成
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contact_attachments', 'contact_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- オブジェクトへのポリシー
-- 誰でもアップロード可能
CREATE POLICY "Allow anyone to upload contact attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contact_attachments');

-- 認証済みユーザーのみ参照可能（管理者として自分も認証済みになるため）
CREATE POLICY "Allow authenticated users to view contact attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'contact_attachments' AND auth.role() = 'authenticated');


-- ==========================================
-- Stats Tables (集計用テーブル)
-- ==========================================

-- 1. song_play_stats (song_id ごとの累計・期間別集計)
CREATE TABLE public.song_play_stats (
  song_id bigint PRIMARY KEY REFERENCES public.songs(id) ON DELETE CASCADE,
  count_24h bigint DEFAULT 0,
  count_7d bigint DEFAULT 0,
  count_30d bigint DEFAULT 0,
  count_total bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 2. master_song_play_stats (master_song_id ごとの累計・期間別集計)
CREATE TABLE public.master_song_play_stats (
  master_song_id bigint PRIMARY KEY REFERENCES public.master_songs(id) ON DELETE CASCADE,
  count_24h bigint DEFAULT 0,
  count_7d bigint DEFAULT 0,
  count_30d bigint DEFAULT 0,
  count_total bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- RPC Functions
-- ==========================================

-- 1. 集計テーブルを最新の状態に更新する関数
CREATE OR REPLACE FUNCTION public.refresh_ranking_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- song_play_stats の更新
  INSERT INTO public.song_play_stats (song_id, count_24h, count_7d, count_30d, count_total, updated_at)
  SELECT 
    s.id as song_id,
    COUNT(ph.id) FILTER (WHERE ph.played_at > now() - interval '1 day'),
    COUNT(ph.id) FILTER (WHERE ph.played_at > now() - interval '7 days'),
    COUNT(ph.id) FILTER (WHERE ph.played_at > now() - interval '30 days'),
    COUNT(ph.id),
    now()
  FROM public.songs s
  LEFT JOIN public.play_history ph ON s.id = ph.song_id
  GROUP BY s.id
  ON CONFLICT (song_id) DO UPDATE SET
    count_24h = EXCLUDED.count_24h,
    count_7d = EXCLUDED.count_7d,
    count_30d = EXCLUDED.count_30d,
    count_total = EXCLUDED.count_total,
    updated_at = EXCLUDED.updated_at;

  -- master_song_play_stats の更新
  INSERT INTO public.master_song_play_stats (master_song_id, count_24h, count_7d, count_30d, count_total, updated_at)
  SELECT 
    ms.id as master_song_id,
    COUNT(ph.id) FILTER (WHERE ph.played_at > now() - interval '1 day'),
    COUNT(ph.id) FILTER (WHERE ph.played_at > now() - interval '7 days'),
    COUNT(ph.id) FILTER (WHERE ph.played_at > now() - interval '30 days'),
    COUNT(ph.id),
    now()
  FROM public.master_songs ms
  LEFT JOIN public.songs s ON ms.id = s.master_song_id
  LEFT JOIN public.play_history ph ON s.id = ph.song_id
  GROUP BY ms.id
  ON CONFLICT (master_song_id) DO UPDATE SET
    count_24h = EXCLUDED.count_24h,
    count_7d = EXCLUDED.count_7d,
    count_30d = EXCLUDED.count_30d,
    count_total = EXCLUDED.count_total,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- 2. グローバル・VTuber別・ユーザー別ランキング取得関数
CREATE OR REPLACE FUNCTION get_song_rankings(
  p_channel_id      bigint  DEFAULT NULL,
  p_user_id         uuid    DEFAULT NULL,
  p_days            integer DEFAULT NULL,
  p_group_by_master boolean DEFAULT false,
  p_limit           integer DEFAULT 10,
  p_offset          integer DEFAULT 0
)
RETURNS TABLE (
  song_id             bigint,
  play_count          bigint,
  master_song_title   text,
  master_song_artist  text,
  master_song_title_en  text,
  master_song_artist_en text,
  artwork_url         text,
  video_id            text,
  video_title         text,
  channel_name        text,
  channel_image       text,
  start_sec           integer,
  end_sec             integer
) 
LANGUAGE plpgsql
SECURITY DEFINER -- 全ユーザーの履歴を集計できるように
AS $$
BEGIN
  -- ユーザー個別ランキングの場合、または特定の期間（24h, 7d, 30d, Total 以外）の場合は動的に集計
  IF p_user_id IS NOT NULL OR (p_days IS NOT NULL AND p_days NOT IN (1, 7, 30)) THEN
    IF p_group_by_master THEN
      RETURN QUERY
      WITH master_counts AS (
        SELECT 
          s.master_song_id,
          COUNT(*) as total_play_count
        FROM public.play_history ph
        JOIN public.songs s ON ph.song_id = s.id
        JOIN public.videos v ON s.video_id = v.id
        JOIN public.channels c ON v.channel_record_id = c.id
        WHERE 
          (p_channel_id IS NULL OR c.id = p_channel_id) AND
          (p_user_id IS NULL OR ph.user_id = p_user_id) AND
          (p_days IS NULL OR ph.played_at > (now() - (p_days || ' days')::interval))
        GROUP BY s.master_song_id
      ),
      representative_songs AS (
        SELECT DISTINCT ON (is_s.master_song_id)
          is_s.master_song_id,
          is_s.id as representative_song_id,
          is_v.video_id,
          is_v.title as video_title,
          is_s.start_sec,
          is_s.end_sec,
          is_c.name as channel_name,
          is_c.image as channel_image
        FROM public.songs is_s
        JOIN public.videos is_v ON is_s.video_id = is_v.id
        JOIN public.channels is_c ON is_v.channel_record_id = is_c.id
        WHERE is_s.master_song_id IS NOT NULL
        ORDER BY is_s.master_song_id, is_v.published_at DESC
      )
      SELECT 
        rs.representative_song_id,
        mc.total_play_count,
        ms.title,
        ms.artist,
        ms.title_en,
        ms.artist_en,
        ms.artwork_url,
        rs.video_id,
        rs.video_title,
        rs.channel_name,
        rs.channel_image,
        rs.start_sec,
        rs.end_sec
      FROM master_counts mc
      JOIN public.master_songs ms ON mc.master_song_id = ms.id
      JOIN representative_songs rs ON mc.master_song_id = rs.master_song_id
      ORDER BY mc.total_play_count DESC, mc.master_song_id ASC
      LIMIT p_limit
      OFFSET p_offset;
    ELSE
      RETURN QUERY
      SELECT 
        ph.song_id,
        COUNT(*) as play_count,
        ms.title,
        ms.artist,
        ms.title_en,
        ms.artist_en,
        ms.artwork_url,
        v.video_id,
        v.title as video_title,
        c.name as channel_name,
        c.image as channel_image,
        s.start_sec,
        s.end_sec
      FROM public.play_history ph
      JOIN public.songs s ON ph.song_id = s.id
      JOIN public.videos v ON s.video_id = v.id
      JOIN public.channels c ON v.channel_record_id = c.id
      LEFT JOIN public.master_songs ms ON s.master_song_id = ms.id
      WHERE 
        (p_channel_id IS NULL OR c.id = p_channel_id) AND
        (p_user_id IS NULL OR ph.user_id = p_user_id) AND
        (p_days IS NULL OR ph.played_at > (now() - (p_days || ' days')::interval))
      GROUP BY 
        ph.song_id, 
        ms.title, ms.artist, ms.title_en, ms.artist_en, ms.artwork_url, 
        v.video_id, v.title, 
        c.name, c.image,
        s.start_sec, s.end_sec
      ORDER BY play_count DESC, ph.song_id ASC
      LIMIT p_limit
      OFFSET p_offset;
    END IF;
  ELSE
    -- 集計用テーブル (Stats Tables) を使用して高速に取得
    IF p_group_by_master THEN
      RETURN QUERY
      WITH representative_songs AS (
        SELECT DISTINCT ON (is_s.master_song_id)
          is_s.master_song_id,
          is_s.id as representative_song_id,
          is_v.video_id,
          is_v.title as video_title,
          is_s.start_sec,
          is_s.end_sec,
          is_c.name as channel_name,
          is_c.image as channel_image
        FROM public.songs is_s
        JOIN public.videos is_v ON is_s.video_id = is_v.id
        JOIN public.channels is_c ON is_v.channel_record_id = is_c.id
        WHERE is_s.master_song_id IS NOT NULL
        ORDER BY is_s.master_song_id, is_v.published_at DESC
      )
      SELECT 
        rs.representative_song_id,
        CASE 
          WHEN p_days = 1  THEN msps.count_24h
          WHEN p_days = 7  THEN msps.count_7d
          WHEN p_days = 30 THEN msps.count_30d
          ELSE msps.count_total
        END as play_count,
        ms.title,
        ms.artist,
        ms.title_en,
        ms.artist_en,
        ms.artwork_url,
        rs.video_id,
        rs.video_title,
        rs.channel_name,
        rs.channel_image,
        rs.start_sec,
        rs.end_sec
      FROM public.master_song_play_stats msps
      JOIN public.master_songs ms ON msps.master_song_id = ms.id
      JOIN representative_songs rs ON msps.master_song_id = rs.master_song_id
      WHERE 
        (p_channel_id IS NULL OR EXISTS (
          SELECT 1 FROM public.songs s_filter 
          JOIN public.videos v_filter ON s_filter.video_id = v_filter.id
          WHERE s_filter.master_song_id = ms.id AND v_filter.channel_record_id = p_channel_id
        ))
      ORDER BY play_count DESC, ms.id ASC
      LIMIT p_limit
      OFFSET p_offset;
    ELSE
      RETURN QUERY
      SELECT 
        s.id as song_id,
        CASE 
          WHEN p_days = 1  THEN sps.count_24h
          WHEN p_days = 7  THEN sps.count_7d
          WHEN p_days = 30 THEN sps.count_30d
          ELSE sps.count_total
        END as play_count,
        ms.title,
        ms.artist,
        ms.title_en,
        ms.artist_en,
        ms.artwork_url,
        v.video_id,
        v.title as video_title,
        c.name as channel_name,
        c.image as channel_image,
        s.start_sec,
        s.end_sec
      FROM public.song_play_stats sps
      JOIN public.songs s ON sps.song_id = s.id
      JOIN public.videos v ON s.video_id = v.id
      JOIN public.channels c ON v.channel_record_id = c.id
      LEFT JOIN public.master_songs ms ON s.master_song_id = ms.id
      WHERE (p_channel_id IS NULL OR c.id = p_channel_id)
      ORDER BY play_count DESC, s.id ASC
      LIMIT p_limit
      OFFSET p_offset;
    END IF;
  END IF;
END;
$$;


