-- ==========================================
-- 20260724000000_add_song_channels.sql
-- 曲単位でのコラボチャンネル（歌唱メンバー）紐づけ用中間テーブル song_channels の追加
-- ==========================================

CREATE TABLE IF NOT EXISTS public.song_channels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  song_id bigint NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  channel_id bigint NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_song_channel UNIQUE (song_id, channel_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_song_channels_song_id ON public.song_channels(song_id);
CREATE INDEX IF NOT EXISTS idx_song_channels_channel_id ON public.song_channels(channel_id);

-- RLS
ALTER TABLE public.song_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on song_channels"
  ON public.song_channels FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated user insert on song_channels"
  ON public.song_channels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated user update on song_channels"
  ON public.song_channels FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated user delete on song_channels"
  ON public.song_channels FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 既存の songs に対して、親動画の channel_record_id または video_channels からデフォルト挿入
INSERT INTO public.song_channels (song_id, channel_id)
SELECT s.id, v.channel_record_id
FROM public.songs s
JOIN public.videos v ON s.video_id = v.id
WHERE v.channel_record_id IS NOT NULL
ON CONFLICT (song_id, channel_id) DO NOTHING;

-- RPC: register_full_archive_transaction を拡張して曲ごとの channelIds (v_song->'channelIds') を処理
CREATE OR REPLACE FUNCTION register_full_archive_transaction(
  p_video_id text,
  p_video_title text,
  p_video_description text,
  p_video_thumbnail_url text,
  p_video_published_at timestamptz,
  p_video_duration integer,
  p_video_is_stream boolean,
  p_channel_yt_id text,
  p_songs jsonb,
  p_collaborator_channel_ids bigint[] DEFAULT '{}'::bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_channel_record_id integer;
  v_video_db_id integer;
  v_song jsonb;
  v_master_song_id integer;
  v_song_id integer;
  v_itunes_id text;
  v_title_ja text;
  v_artist_ja text;
  v_title_en text;
  v_artist_en text;
  v_artwork_url text;
  v_duration_sec integer;
  v_start_sec integer;
  v_end_sec integer;
  v_is_deleted boolean;
  v_user_id uuid;
  v_result_songs jsonb := '[]'::jsonb;
  v_registered_song jsonb;
  v_collab_id bigint;
  v_song_channel_id bigint;
  v_song_channel_ids jsonb;
BEGIN
  -- 現在の認証ユーザーIDを取得
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 1. チャンネルの内部IDを取得
  SELECT id INTO v_channel_record_id
  FROM channels
  WHERE yt_channel_id = p_channel_yt_id;

  IF v_channel_record_id IS NULL THEN
    RAISE EXCEPTION 'Channel with yt_channel_id % is not registered.', p_channel_yt_id;
  END IF;

  -- 2. 動画の登録/取得
  SELECT id INTO v_video_db_id FROM videos WHERE video_id = p_video_id;
  IF v_video_db_id IS NULL THEN
    INSERT INTO videos (
      video_id, title, description, thumbnail_url, published_at, duration, channel_record_id, is_stream, is_publish, created_by
    )
    VALUES (
      p_video_id, p_video_title, p_video_description, p_video_thumbnail_url, p_video_published_at, p_video_duration, v_channel_record_id, p_video_is_stream, true, v_user_id
    )
    RETURNING id INTO v_video_db_id;
  ELSE
    -- 既存動画の場合でも channel_record_id が未設定なら更新
    UPDATE videos
    SET channel_record_id = v_channel_record_id
    WHERE id = v_video_db_id AND channel_record_id IS NULL;
  END IF;

  -- 3. video_channels にアップロード元を登録
  INSERT INTO video_channels (video_id, channel_id, is_original)
  VALUES (v_video_db_id, v_channel_record_id, true)
  ON CONFLICT (video_id, channel_id) DO NOTHING;

  -- 4. コラボチャンネルを video_channels に登録
  IF p_collaborator_channel_ids IS NOT NULL AND array_length(p_collaborator_channel_ids, 1) > 0 THEN
    FOREACH v_collab_id IN ARRAY p_collaborator_channel_ids
    LOOP
      IF v_collab_id <> v_channel_record_id THEN
        INSERT INTO video_channels (video_id, channel_id, is_original)
        VALUES (v_video_db_id, v_collab_id, false)
        ON CONFLICT (video_id, channel_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- 5. 曲のループ処理
  FOR v_song IN SELECT * FROM jsonb_array_elements(p_songs)
  LOOP
    v_song_id := (v_song->>'id')::integer;
    v_is_deleted := coalesce((v_song->>'isDeleted')::boolean, false);

    -- 削除処理
    IF v_is_deleted THEN
      IF v_song_id IS NOT NULL THEN
        DELETE FROM songs WHERE id = v_song_id;
      END IF;
      CONTINUE;
    END IF;

    -- パラメータ抽出
    v_title_ja := v_song->>'titleJa';
    v_artist_ja := v_song->>'artistJa';
    v_title_en := v_song->>'titleEn';
    v_artist_en := v_song->>'artistEn';
    v_artwork_url := v_song->>'artworkUrl';
    v_itunes_id := v_song->>'itunesId';
    v_duration_sec := (v_song->>'durationSec')::integer;
    v_start_sec := (v_song->>'startSec')::integer;
    v_end_sec := (v_song->>'endSec')::integer;
    v_song_channel_ids := v_song->'channelIds';

    -- master_songs の存在チェック
    v_master_song_id := NULL;
    IF v_itunes_id IS NOT NULL AND v_itunes_id <> '' THEN
      SELECT id INTO v_master_song_id FROM master_songs WHERE itunes_id = v_itunes_id;
    END IF;

    IF v_master_song_id IS NULL THEN
      SELECT id INTO v_master_song_id FROM master_songs 
      WHERE title = v_title_ja AND artist = v_artist_ja;
    END IF;

    -- 存在しなければ master_songs に INSERT
    IF v_master_song_id IS NULL THEN
      INSERT INTO master_songs (
        title, artist, title_en, artist_en, artwork_url, itunes_id, duration_sec, created_by
      )
      VALUES (
        v_title_ja, v_artist_ja, v_title_en, v_artist_en, v_artwork_url, NULLIF(v_itunes_id, ''), NULLIF(v_duration_sec, 0), v_user_id
      )
      RETURNING id INTO v_master_song_id;
    END IF;

    -- songs テーブルへの INSERT / UPDATE
    IF v_song_id IS NOT NULL THEN
      -- 更新
      UPDATE songs
      SET master_song_id = v_master_song_id,
          start_sec = v_start_sec,
          end_sec = v_end_sec,
          updated_by = v_user_id,
          updated_at = now()
      WHERE id = v_song_id;
    ELSE
      -- 新規登録
      INSERT INTO songs (
        video_id, master_song_id, start_sec, end_sec, created_by
      )
      VALUES (
        v_video_db_id, v_master_song_id, v_start_sec, v_end_sec, v_user_id
      )
      RETURNING id INTO v_song_id;
    END IF;

    -- song_channels の紐づけ処理
    IF v_song_channel_ids IS NOT NULL AND jsonb_array_length(v_song_channel_ids) > 0 THEN
      DELETE FROM song_channels WHERE song_id = v_song_id;
      FOR v_song_channel_id IN SELECT (value::text)::bigint FROM jsonb_array_elements_text(v_song_channel_ids)
      LOOP
        INSERT INTO song_channels (song_id, channel_id)
        VALUES (v_song_id, v_song_channel_id)
        ON CONFLICT (song_id, channel_id) DO NOTHING;
      END LOOP;
    ELSE
      -- 指定がない場合、既に song_channels に存在しなければ親動画の投稿元をデフォルト登録
      INSERT INTO song_channels (song_id, channel_id)
      VALUES (v_song_id, v_channel_record_id)
      ON CONFLICT (song_id, channel_id) DO NOTHING;
    END IF;

    -- 結果用の曲データを取得して配列に追加
    SELECT json_build_object(
      'id', s.id,
      'video_id', s.video_id,
      'master_song_id', s.master_song_id,
      'start_sec', s.start_sec,
      'end_sec', s.end_sec,
      'master_song', json_build_object(
        'id', m.id,
        'title', m.title,
        'artist', m.artist,
        'title_en', m.title_en,
        'artist_en', m.artist_en,
        'artwork_url', m.artwork_url,
        'itunes_id', m.itunes_id,
        'duration_sec', m.duration_sec
      )
    )::jsonb INTO v_registered_song
    FROM songs s
    JOIN master_songs m ON s.master_song_id = m.id
    WHERE s.id = v_song_id;

    v_result_songs := v_result_songs || jsonb_build_array(v_registered_song);

  END LOOP;

  -- 結果の返却 (video と songs をまとめた JSON)
  RETURN json_build_object(
    'video', (
      SELECT json_build_object(
        'id', id,
        'video_id', video_id,
        'title', title,
        'description', description,
        'thumbnail_url', thumbnail_url,
        'published_at', published_at,
        'duration', duration,
        'channel_record_id', channel_record_id,
        'is_stream', is_stream,
        'is_publish', is_publish
      ) FROM videos WHERE id = v_video_db_id
    ),
    'songs', v_result_songs
  );

END;
$$;
