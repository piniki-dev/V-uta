-- channels テーブルに is_primary カラムを追加 (デフォルト true)
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true;

-- コメント追加
COMMENT ON COLUMN public.channels.is_primary IS 'メインチャンネルかどうか (false の場合はサブ/トピックチャンネル)';
