-- Create register_full_archive_transaction function to execute video and songs inserts/updates in a single transaction.

CREATE OR REPLACE FUNCTION register_full_archive_transaction(
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
  END IF;

  -- 3. 曲のループ処理
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
