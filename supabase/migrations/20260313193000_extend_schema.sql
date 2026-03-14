-- productions テーブル: 事務所または個人勢
CREATE TABLE public.productions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  link text,
  created_at timestamptz DEFAULT now()
);

-- vtubers テーブル
CREATE TABLE public.vtubers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  gender text CHECK (gender IN ('男性', '女性', 'その他', '不明')),
  link text,
  production_id bigint REFERENCES public.productions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- channels テーブル: YouTube チャンネル
CREATE TABLE public.channels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yt_channel_id text NOT NULL UNIQUE, -- YouTube 固有の ID (UC...)
  name text NOT NULL,
  handle text,
  description text,
  image text,
  vtuber_id bigint REFERENCES public.vtubers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- videos テーブルの改修
-- 1. 新しい channel_id (FK) カラムを追加
ALTER TABLE public.videos ADD COLUMN channel_record_id bigint REFERENCES public.channels(id);

-- 2. 動画の属性を追加
ALTER TABLE public.videos ADD COLUMN description text;
ALTER TABLE public.videos ADD COLUMN thumbnail text; -- 重複するが整理のため
ALTER TABLE public.videos ADD COLUMN duration interval;
ALTER TABLE public.videos ADD COLUMN is_stream boolean DEFAULT true;

-- RLS 有効化
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vtubers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- 簡易的なポリシー (後ほど認証に応じて調整)
DROP POLICY IF EXISTS "productions_select_all" ON public.productions;
CREATE POLICY "productions_select_all" ON public.productions FOR SELECT USING (true);
DROP POLICY IF EXISTS "productions_insert_auth" ON public.productions;
CREATE POLICY "productions_insert_auth" ON public.productions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "vtubers_select_all" ON public.vtubers;
CREATE POLICY "vtubers_select_all" ON public.vtubers FOR SELECT USING (true);
DROP POLICY IF EXISTS "vtubers_insert_auth" ON public.vtubers;
CREATE POLICY "vtubers_insert_auth" ON public.vtubers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "channels_select_all" ON public.channels;
CREATE POLICY "channels_select_all" ON public.channels FOR SELECT USING (true);
DROP POLICY IF EXISTS "channels_insert_auth" ON public.channels;
CREATE POLICY "channels_insert_auth" ON public.channels FOR INSERT WITH CHECK (true);

-- インデックス
CREATE INDEX idx_vtubers_production_id ON public.vtubers(production_id);
CREATE INDEX idx_channels_vtuber_id ON public.channels(vtuber_id);
CREATE INDEX idx_channels_yt_channel_id ON public.channels(yt_channel_id);
CREATE INDEX idx_videos_channel_record_id ON public.videos(channel_record_id);
