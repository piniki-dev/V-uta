-- Migration: Refactor video_channels unification and remove dependency on videos.channel_record_id

-- 1. 既存の videos レコードの channel_record_id から video_channels (is_original = true) へ補完挿入
INSERT INTO public.video_channels (video_id, channel_id, is_original)
SELECT id, channel_record_id, true
FROM public.videos
WHERE channel_record_id IS NOT NULL
ON CONFLICT (video_id, channel_id) DO UPDATE SET is_original = EXCLUDED.is_original;

-- 2. register_full_archive_transaction RPC の再定義 (videos.channel_record_id への挿入・更新を排除)
CREATE OR REPLACE FUNCTION public.register_full_archive_transaction(
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
  v_main_channel_id integer;
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

  -- 1. 投稿主チャンネルの内部IDを取得
  SELECT id INTO v_main_channel_id
  FROM public.channels
  WHERE yt_channel_id = p_channel_yt_id;

  IF v_main_channel_id IS NULL THEN
    RAISE EXCEPTION 'Channel with yt_channel_id % is not registered.', p_channel_yt_id;
  END IF;

  -- 2. 動画の登録/取得 (channel_record_id への書き込みなし)
  SELECT id INTO v_video_db_id FROM public.videos WHERE video_id = p_video_id;
  IF v_video_db_id IS NULL THEN
    INSERT INTO public.videos (
      video_id, title, description, thumbnail_url, published_at, duration, is_stream, is_publish, created_by
    )
    VALUES (
      p_video_id, p_video_title, p_video_description, p_video_thumbnail_url, p_video_published_at, p_video_duration, p_video_is_stream, true, v_user_id
    )
    RETURNING id INTO v_video_db_id;
  END IF;

  -- 3. video_channels にアップロード元を登録 (is_original = true)
  INSERT INTO public.video_channels (video_id, channel_id, is_original)
  VALUES (v_video_db_id, v_main_channel_id, true)
  ON CONFLICT (video_id, channel_id) DO UPDATE SET is_original = true;

  -- 4. コラボチャンネルを video_channels に登録 (is_original = false)
  IF p_collaborator_channel_ids IS NOT NULL AND array_length(p_collaborator_channel_ids, 1) > 0 THEN
    FOREACH v_collab_id IN ARRAY p_collaborator_channel_ids
    LOOP
      IF v_collab_id <> v_main_channel_id THEN
        INSERT INTO public.video_channels (video_id, channel_id, is_original)
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
    IF v_song_id IS NOT NULL AND v_is_deleted THEN
      UPDATE public.songs
      SET is_active = false, updated_at = now(), updated_by = v_user_id
      WHERE id = v_song_id;
      CONTINUE;
    END IF;

    -- 変数の抽出
    v_itunes_id := v_song->>'itunesId';
    v_title_ja := v_song->>'titleJa';
    v_artist_ja := v_song->>'artistJa';
    v_title_en := v_song->>'titleEn';
    v_artist_en := v_song->>'artistEn';
    v_artwork_url := v_song->>'artworkUrl';
    v_duration_sec := (v_song->>'durationSec')::integer;
    v_start_sec := (v_song->>'startSec')::integer;
    v_end_sec := (v_song->>'endSec')::integer;

    -- master_songs の取得・更新・登録
    v_master_song_id := NULL;
    IF v_itunes_id IS NOT NULL AND v_itunes_id <> '' THEN
      SELECT id INTO v_master_song_id FROM public.master_songs WHERE itunes_id = v_itunes_id;
    END IF;

    IF v_master_song_id IS NULL THEN
      SELECT id INTO v_master_song_id
      FROM public.master_songs
      WHERE lower(title) = lower(v_title_ja) AND lower(artist) = lower(v_artist_ja);
    END IF;

    IF v_master_song_id IS NULL THEN
      INSERT INTO public.master_songs (
        title, artist, title_en, artist_en, artwork_url, itunes_id, duration_sec, created_by
      )
      VALUES (
        v_title_ja, v_artist_ja, v_title_en, v_artist_en, v_artwork_url, v_itunes_id, v_duration_sec, v_user_id
      )
      RETURNING id INTO v_master_song_id;
    ELSE
      UPDATE public.master_songs
      SET
        title_en = coalesce(title_en, v_title_en),
        artist_en = coalesce(artist_en, v_artist_en),
        artwork_url = coalesce(artwork_url, v_artwork_url),
        itunes_id = coalesce(itunes_id, v_itunes_id),
        duration_sec = coalesce(duration_sec, v_duration_sec),
        updated_at = now(),
        updated_by = v_user_id
      WHERE id = v_master_song_id;
    END IF;

    -- songs の登録・更新
    IF v_song_id IS NULL THEN
      INSERT INTO public.songs (
        video_id, master_song_id, start_sec, end_sec, is_active, created_by
      )
      VALUES (
        v_video_db_id, v_master_song_id, v_start_sec, v_end_sec, true, v_user_id
      )
      RETURNING id INTO v_song_id;
    ELSE
      UPDATE public.songs
      SET
        master_song_id = v_master_song_id,
        start_sec = v_start_sec,
        end_sec = v_end_sec,
        is_active = true,
        updated_at = now(),
        updated_by = v_user_id
      WHERE id = v_song_id;
    END IF;

    -- song_channels (歌唱メンバー) の保存
    v_song_channel_ids := v_song->'channelIds';

    IF v_song_channel_ids IS NOT NULL AND jsonb_array_length(v_song_channel_ids) > 0 THEN
      DELETE FROM public.song_channels WHERE song_id = v_song_id;

      FOR v_song_channel_id IN SELECT (value::text)::bigint FROM jsonb_array_elements_text(v_song_channel_ids)
      LOOP
        INSERT INTO public.song_channels (song_id, channel_id)
        VALUES (v_song_id, v_song_channel_id)
        ON CONFLICT (song_id, channel_id) DO NOTHING;
      END LOOP;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.song_channels WHERE song_id = v_song_id) THEN
        INSERT INTO public.song_channels (song_id, channel_id)
        VALUES (v_song_id, v_main_channel_id)
        ON CONFLICT (song_id, channel_id) DO NOTHING;

        IF p_collaborator_channel_ids IS NOT NULL AND array_length(p_collaborator_channel_ids, 1) > 0 THEN
          FOREACH v_collab_id IN ARRAY p_collaborator_channel_ids
          LOOP
            IF v_collab_id <> v_main_channel_id THEN
              INSERT INTO public.song_channels (song_id, channel_id)
              VALUES (v_song_id, v_collab_id)
              ON CONFLICT (song_id, channel_id) DO NOTHING;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    -- 登録後の Song オブジェクトを構築
    SELECT jsonb_build_object(
      'id', s.id,
      'video_id', s.video_id,
      'master_song_id', s.master_song_id,
      'start_sec', s.start_sec,
      'end_sec', s.end_sec,
      'is_active', s.is_active,
      'master_song', jsonb_build_object(
        'id', ms.id,
        'title', ms.title,
        'artist', ms.artist,
        'title_en', ms.title_en,
        'artist_en', ms.artist_en,
        'artwork_url', ms.artwork_url,
        'itunes_id', ms.itunes_id,
        'duration_sec', ms.duration_sec
      )
    ) INTO v_registered_song
    FROM public.songs s
    JOIN public.master_songs ms ON s.master_song_id = ms.id
    WHERE s.id = v_song_id;

    v_result_songs := v_result_songs || jsonb_build_array(v_registered_song);
  END LOOP;

  -- レスポンス全体の組み立て
  RETURN jsonb_build_object(
    'video', (
      SELECT jsonb_build_object(
        'id', v.id,
        'video_id', v.video_id,
        'title', v.title,
        'description', v.description,
        'thumbnail_url', v.thumbnail_url,
        'published_at', v.published_at,
        'duration', v.duration,
        'is_stream', v.is_stream,
        'is_publish', v.is_publish
      )
      FROM public.videos v
      WHERE v.id = v_video_db_id
    ),
    'songs', v_result_songs
  );
END;
$$;

-- 3. videos テーブルから不要となった channel_record_id カラムを完全に物理削除 (依存するインデックス・ビュー等も同時に削除)
ALTER TABLE public.videos DROP COLUMN IF EXISTS channel_record_id CASCADE;

-- 4. CASCADE で削除された mv_representative_songs (マテリアライズドビュー) を video_channels 主軸で再構築
CREATE MATERIALIZED VIEW public.mv_representative_songs AS
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
JOIN public.video_channels vc ON v.id = vc.video_id AND vc.is_original = true
JOIN public.channels c ON vc.channel_id = c.id
WHERE s.master_song_id IS NOT NULL
ORDER BY s.master_song_id, v.published_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_rep_songs_master_song_id 
ON public.mv_representative_songs (master_song_id);

CREATE INDEX IF NOT EXISTS idx_mv_rep_songs_channel_id 
ON public.mv_representative_songs (channel_id);

GRANT SELECT ON public.mv_representative_songs TO anon;
GRANT SELECT ON public.mv_representative_songs TO authenticated;
