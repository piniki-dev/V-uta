-- ==========================================
-- Slow Query Optimization Migration
-- ==========================================
-- Target: Top 3 slow queries (84% of total DB time)
--   1. get_song_rankings RPC (54.1%)
--   2. refresh_ranking_stats RPC (16.6%)
--   3. Videos listing query (14.0%)

-- ==========================================
-- 1. Videos listing: created_at index
--    index_advisor recommendation: cost 92.76 → 19.83
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_videos_created_at 
ON public.videos (created_at DESC);

-- ==========================================
-- 2. Materialized View: representative songs
--    Eliminates per-call DISTINCT ON full scan
--    in get_song_rankings (130K calls/period)
-- ==========================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_representative_songs AS
SELECT DISTINCT ON (s.master_song_id)
  s.master_song_id,
  s.id AS representative_song_id,
  v.video_id,
  v.title AS video_title,
  s.start_sec,
  s.end_sec,
  c.id AS channel_id,
  c.name AS channel_name,
  c.handle AS channel_handle,
  c.image AS channel_image
FROM public.songs s
JOIN public.videos v ON s.video_id = v.id
JOIN public.channels c ON v.channel_record_id = c.id
WHERE s.master_song_id IS NOT NULL
ORDER BY s.master_song_id, v.published_at DESC;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_rep_songs_master_song_id 
ON public.mv_representative_songs (master_song_id);

-- Channel filter optimization
CREATE INDEX IF NOT EXISTS idx_mv_rep_songs_channel_id 
ON public.mv_representative_songs (channel_id);

-- ==========================================
-- 3. Stats Tables: sort optimization indexes
-- ==========================================
-- song_play_stats
CREATE INDEX IF NOT EXISTS idx_sps_count_total ON public.song_play_stats (count_total DESC);
CREATE INDEX IF NOT EXISTS idx_sps_count_24h   ON public.song_play_stats (count_24h DESC);
CREATE INDEX IF NOT EXISTS idx_sps_count_7d    ON public.song_play_stats (count_7d DESC);
CREATE INDEX IF NOT EXISTS idx_sps_count_30d   ON public.song_play_stats (count_30d DESC);

-- master_song_play_stats
CREATE INDEX IF NOT EXISTS idx_msps_count_total ON public.master_song_play_stats (count_total DESC);
CREATE INDEX IF NOT EXISTS idx_msps_count_24h   ON public.master_song_play_stats (count_24h DESC);
CREATE INDEX IF NOT EXISTS idx_msps_count_7d    ON public.master_song_play_stats (count_7d DESC);
CREATE INDEX IF NOT EXISTS idx_msps_count_30d   ON public.master_song_play_stats (count_30d DESC);

-- ==========================================
-- 4. play_history: composite index for
--    user-specific ranking queries
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_play_history_user_song_played 
ON public.play_history (user_id, song_id, played_at DESC);

-- ==========================================
-- 5. refresh_ranking_stats() optimization
--    - Derive master_song_play_stats from
--      song_play_stats (avoid double scan)
--    - Skip unchanged rows with IS DISTINCT FROM
--    - Refresh materialized view concurrently
-- ==========================================
CREATE OR REPLACE FUNCTION public.refresh_ranking_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
    song_play_stats.count_24h IS DISTINCT FROM EXCLUDED.count_24h OR
    song_play_stats.count_7d IS DISTINCT FROM EXCLUDED.count_7d OR
    song_play_stats.count_30d IS DISTINCT FROM EXCLUDED.count_30d OR
    song_play_stats.count_total IS DISTINCT FROM EXCLUDED.count_total;

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
    master_song_play_stats.count_24h IS DISTINCT FROM EXCLUDED.count_24h OR
    master_song_play_stats.count_7d IS DISTINCT FROM EXCLUDED.count_7d OR
    master_song_play_stats.count_30d IS DISTINCT FROM EXCLUDED.count_30d OR
    master_song_play_stats.count_total IS DISTINCT FROM EXCLUDED.count_total;

  -- マテリアライズドビューの更新（ロックを最小化）
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_representative_songs;
END;
$$;

-- ==========================================
-- 6. get_song_rankings() optimization
--    - Replace representative_songs CTE with
--      mv_representative_songs materialized view
--    - Maintains same return type signature
-- ==========================================
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
      -- ★ マテリアライズドビューを使用（CTEの代わり）
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
      -- ★ マテリアライズドビューを直接参照（CTEの代わり）
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

-- ==========================================
-- Grant access to the materialized view
-- ==========================================
GRANT SELECT ON public.mv_representative_songs TO anon;
GRANT SELECT ON public.mv_representative_songs TO authenticated;
