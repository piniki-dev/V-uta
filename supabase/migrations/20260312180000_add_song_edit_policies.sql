-- songs テーブルの UPDATE/DELETE ポリシーを追加（ログインユーザーのみ）
CREATE POLICY "songs_update_auth" ON public.songs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "songs_delete_auth" ON public.songs FOR DELETE USING (auth.uid() IS NOT NULL);

-- master_songs の UPDATE ポリシー（artwork_url 等の更新用）
-- 既に 20260312165000 で追加済みの場合はスキップ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'master_songs_update_auth' AND tablename = 'master_songs'
  ) THEN
    CREATE POLICY "master_songs_update_auth" ON public.master_songs FOR UPDATE USING (true) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
