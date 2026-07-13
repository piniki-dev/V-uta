-- ==========================================
-- Security Warnings Fix Migration
-- ==========================================
-- Fixes reported by Supabase Database Linter:
--   1. Function Search Path Mutable (8 functions)
--   2. SECURITY DEFINER callable by anon (5 functions)
--   3. SECURITY DEFINER callable by authenticated (5 functions)
-- 
-- NOT addressed here (requires Dashboard):
--   - Leaked Password Protection (Auth setting)
--   - Materialized View in API (intentional)
--   - RLS Policy Always True on inquiries (intentional)

-- ==========================================
-- 1. Fix search_path on trigger functions
--    (SET search_path = '' to prevent injection)
-- ==========================================

-- 1-1. handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 1-2. handle_song_history
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
$$ LANGUAGE plpgsql SET search_path = '';

-- 1-3. handle_new_user_favorites
CREATE OR REPLACE FUNCTION public.handle_new_user_favorites()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.playlists (name, description, is_favorites, created_by, is_public, slug)
  VALUES (
    'お気に入りした曲', 
    'お気に入りした楽曲がここに表示されます', 
    true, 
    NEW.id, 
    false, 
    'favorites-' || NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 1-4. prevent_favorite_playlist_deletion
CREATE OR REPLACE FUNCTION public.prevent_favorite_playlist_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_favorites = true THEN
    RAISE EXCEPTION 'お気に入りプレイリストは削除できません。';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ==========================================
-- 2. Fix search_path on RPC functions
-- ==========================================

-- 2-1. get_random_song_ids_by_channel (SQL function)
CREATE OR REPLACE FUNCTION public.get_random_song_ids_by_channel(
  p_channel_record_id bigint,
  p_exclude_ids bigint[],
  p_limit int
)
RETURNS TABLE(song_id bigint)
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.songs s
  JOIN public.videos v ON s.video_id = v.id
  WHERE v.channel_record_id = p_channel_record_id
    AND s.is_active = true
    AND NOT (s.id = ANY(p_exclude_ids))
  ORDER BY random()
  LIMIT p_limit;
$$;

-- 2-2. refresh_ranking_stats
CREATE OR REPLACE FUNCTION public.refresh_ranking_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- song_play_stats の更新
  INSERT INTO public.song_play_stats (song_id, count_24h, count_7d, count_30d, count_total, updated_at)
  SELECT 
    s.id AS song_id,
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
    updated_at = EXCLUDED.updated_at
  WHERE 
    public.song_play_stats.count_24h IS DISTINCT FROM EXCLUDED.count_24h OR
    public.song_play_stats.count_7d IS DISTINCT FROM EXCLUDED.count_7d OR
    public.song_play_stats.count_30d IS DISTINCT FROM EXCLUDED.count_30d OR
    public.song_play_stats.count_total IS DISTINCT FROM EXCLUDED.count_total;

  -- master_song_play_stats: song_play_statsから導出（play_historyを再スキャンしない）
  INSERT INTO public.master_song_play_stats (master_song_id, count_24h, count_7d, count_30d, count_total, updated_at)
  SELECT 
    ms.id AS master_song_id,
    COALESCE(SUM(sps.count_24h), 0),
    COALESCE(SUM(sps.count_7d), 0),
    COALESCE(SUM(sps.count_30d), 0),
    COALESCE(SUM(sps.count_total), 0),
    now()
  FROM public.master_songs ms
  LEFT JOIN public.songs s ON ms.id = s.master_song_id
  LEFT JOIN public.song_play_stats sps ON s.id = sps.song_id
  GROUP BY ms.id
  ON CONFLICT (master_song_id) DO UPDATE SET
    count_24h = EXCLUDED.count_24h,
    count_7d = EXCLUDED.count_7d,
    count_30d = EXCLUDED.count_30d,
    count_total = EXCLUDED.count_total,
    updated_at = EXCLUDED.updated_at
  WHERE 
    public.master_song_play_stats.count_24h IS DISTINCT FROM EXCLUDED.count_24h OR
    public.master_song_play_stats.count_7d IS DISTINCT FROM EXCLUDED.count_7d OR
    public.master_song_play_stats.count_30d IS DISTINCT FROM EXCLUDED.count_30d OR
    public.master_song_play_stats.count_total IS DISTINCT FROM EXCLUDED.count_total;

  -- マテリアライズドビューの更新（ロックを最小化）
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_representative_songs;
END;
$$;

-- 2-3. get_song_rankings
DROP FUNCTION IF EXISTS public.get_song_rankings(bigint, uuid, integer, boolean, integer, integer);

CREATE OR REPLACE FUNCTION public.get_song_rankings(
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
  channel_id          bigint,
  channel_name        text,
  channel_handle      text,
  channel_image       text,
  start_sec           integer,
  end_sec             integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
        rs.channel_id,
        rs.channel_name,
        rs.channel_handle,
        rs.channel_image,
        rs.start_sec,
        rs.end_sec
      FROM master_counts mc
      JOIN public.master_songs ms ON mc.master_song_id = ms.id
      JOIN public.mv_representative_songs rs ON mc.master_song_id = rs.master_song_id
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
        c.id as channel_id,
        c.name as channel_name,
        c.handle as channel_handle,
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
        c.id, c.name, c.handle, c.image,
        s.start_sec, s.end_sec
      ORDER BY play_count DESC, ph.song_id ASC
      LIMIT p_limit
      OFFSET p_offset;
    END IF;
  ELSE
    -- 集計用テーブル (Stats Tables) を使用して高速に取得
    IF p_group_by_master THEN
      RETURN QUERY
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
        rs.channel_id,
        rs.channel_name,
        rs.channel_handle,
        rs.channel_image,
        rs.start_sec,
        rs.end_sec
      FROM public.master_song_play_stats msps
      JOIN public.master_songs ms ON msps.master_song_id = ms.id
      JOIN public.mv_representative_songs rs ON msps.master_song_id = rs.master_song_id
      WHERE 
        (p_channel_id IS NULL OR rs.channel_id = p_channel_id)
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
        c.id as channel_id,
        c.name as channel_name,
        c.handle as channel_handle,
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

-- 2-4. register_full_archive_transaction
CREATE OR REPLACE FUNCTION public.register_full_archive_transaction(
  p_video_id text,
  p_video_title text,
  p_video_description text,
  p_video_thumbnail_url text,
  p_video_published_at timestamptz,
  p_video_duration integer,
  p_video_is_stream boolean,
  p_channel_yt_id text,
  p_songs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
BEGIN
  -- 現在の認証ユーザーIDを取得
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 1. チャンネルの内部IDを取得
  SELECT id INTO v_channel_record_id
  FROM public.channels
  WHERE yt_channel_id = p_channel_yt_id;

  IF v_channel_record_id IS NULL THEN
    RAISE EXCEPTION 'Channel with yt_channel_id % is not registered.', p_channel_yt_id;
  END IF;

  -- 2. 動画の登録/取得
  SELECT id INTO v_video_db_id FROM public.videos WHERE video_id = p_video_id;
  IF v_video_db_id IS NULL THEN
    INSERT INTO public.videos (
      video_id, title, description, thumbnail_url, published_at, duration, channel_record_id, is_stream, is_publish, created_by
    )
    VALUES (
      p_video_id, p_video_title, p_video_description, p_video_thumbnail_url, p_video_published_at, p_video_duration, v_channel_record_id, p_video_is_stream, true, v_user_id
    )
    RETURNING id INTO v_video_db_id;
  END IF;

  -- 3. 曲のループ処理
  FOR v_song IN SELECT * FROM jsonb_array_elements(p_songs)
  LOOP
    v_song_id := (v_song->>'id')::integer;
    v_is_deleted := coalesce((v_song->>'isDeleted')::boolean, false);

    -- 削除処理
    IF v_is_deleted THEN
      IF v_song_id IS NOT NULL THEN
        DELETE FROM public.songs WHERE id = v_song_id;
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

    -- master_songs の存在チェック
    v_master_song_id := NULL;
    IF v_itunes_id IS NOT NULL AND v_itunes_id <> '' THEN
      SELECT id INTO v_master_song_id FROM public.master_songs WHERE itunes_id = v_itunes_id;
    END IF;

    IF v_master_song_id IS NULL THEN
      SELECT id INTO v_master_song_id FROM public.master_songs 
      WHERE title = v_title_ja AND artist = v_artist_ja;
    END IF;

    -- 存在しなければ master_songs に INSERT
    IF v_master_song_id IS NULL THEN
      INSERT INTO public.master_songs (
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
      UPDATE public.songs
      SET master_song_id = v_master_song_id,
          start_sec = v_start_sec,
          end_sec = v_end_sec,
          updated_by = v_user_id,
          updated_at = now()
      WHERE id = v_song_id;
    ELSE
      -- 新規登録
      INSERT INTO public.songs (
        video_id, master_song_id, start_sec, end_sec, created_by
      )
      VALUES (
        v_video_db_id, v_master_song_id, v_start_sec, v_end_sec, v_user_id
      )
      RETURNING id INTO v_song_id;
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
    FROM public.songs s
    JOIN public.master_songs m ON s.master_song_id = m.id
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
      ) FROM public.videos WHERE id = v_video_db_id
    ),
    'songs', v_result_songs
  );

END;
$$;

-- ==========================================
-- 3. Revoke EXECUTE from anon/authenticated
--    on functions that should not be called
--    via REST API
-- ==========================================

-- トリガー関数: RPC として呼び出されるべきではない
REVOKE EXECUTE ON FUNCTION public.handle_new_user_favorites() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_song_history() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_favorite_playlist_deletion() FROM anon, authenticated;

-- 管理用関数: cron / service_role からのみ呼び出すべき
REVOKE EXECUTE ON FUNCTION public.refresh_ranking_stats() FROM anon, authenticated;

-- register_full_archive_transaction: 認証必須なので anon には不要
REVOKE EXECUTE ON FUNCTION public.register_full_archive_transaction(
  text, text, text, text, timestamptz, integer, boolean, text, jsonb
) FROM anon;

-- rls_auto_enable: 存在する場合のみ実行（Supabase 自動生成の可能性）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated';
  END IF;
END;
$$;
