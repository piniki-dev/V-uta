-- get_song_rankings 関数の更新
-- 戻り値の型を変更するため、一度関数を削除してから再定義する
DROP FUNCTION IF EXISTS get_song_rankings(bigint, uuid, integer, boolean, integer, integer);

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
  channel_id          bigint,
  channel_name        text,
  channel_handle      text,
  channel_image       text,
  start_sec           integer,
  end_sec             integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
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
          is_c.id as channel_id,
          is_c.name as channel_name,
          is_c.handle as channel_handle,
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
        rs.channel_id,
        rs.channel_name,
        rs.channel_handle,
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
      WITH representative_songs AS (
        SELECT DISTINCT ON (is_s.master_song_id)
          is_s.master_song_id,
          is_s.id as representative_song_id,
          is_v.video_id,
          is_v.title as video_title,
          is_s.start_sec,
          is_s.end_sec,
          is_c.id as channel_id,
          is_c.name as channel_name,
          is_c.handle as channel_handle,
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
        rs.channel_id,
        rs.channel_name,
        rs.channel_handle,
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
