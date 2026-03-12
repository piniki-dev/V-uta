-- master_songs テーブル: 原曲メタデータの一元管理（正規化）
CREATE TABLE public.master_songs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  artist text NOT NULL,
  artwork_url text,
  itunes_id text,
  created_at timestamptz DEFAULT now(),
  -- 曲名とアーティスト名の組み合わせで名寄せ（一意制約）
  CONSTRAINT unique_song_title_artist UNIQUE (title, artist)
);

-- RLS 有効化
ALTER TABLE public.master_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_songs_select_all" ON public.master_songs FOR SELECT USING (true);
CREATE POLICY "master_songs_insert_auth" ON public.master_songs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- UPSERT で既存行を更新するためのポリシー
CREATE POLICY "master_songs_update_auth" ON public.master_songs FOR UPDATE USING (true) WITH CHECK (auth.uid() IS NOT NULL);

-- songs テーブルに master_song_id カラムを追加
ALTER TABLE public.songs ADD COLUMN master_song_id bigint REFERENCES public.master_songs(id);

-- 既存データの移行: songs.title / songs.artist → master_songs に挿入し紐付け
-- （開発初期のため、既存データがあれば移行。無ければ何もしない）
INSERT INTO public.master_songs (title, artist)
SELECT DISTINCT title, COALESCE(artist, 'Unknown')
FROM public.songs
WHERE title IS NOT NULL
ON CONFLICT (title, artist) DO NOTHING;

UPDATE public.songs s
SET master_song_id = ms.id
FROM public.master_songs ms
WHERE s.title = ms.title AND COALESCE(s.artist, 'Unknown') = ms.artist;

-- 移行完了後、旧カラムを削除
ALTER TABLE public.songs DROP COLUMN IF EXISTS title;
ALTER TABLE public.songs DROP COLUMN IF EXISTS artist;

-- master_songs の検索用インデックス
CREATE INDEX idx_master_songs_title ON public.master_songs(title);
