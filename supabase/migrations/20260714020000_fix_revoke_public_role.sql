-- ==========================================
-- Fix REVOKE: must include PUBLIC role
-- ==========================================
-- PostgreSQL grants EXECUTE to PUBLIC by default.
-- anon/authenticated inherit from PUBLIC, so we must
-- REVOKE from PUBLIC first, then re-GRANT only to
-- roles that actually need access.
--
-- Previous migration (20260714010000) revoked only
-- from anon/authenticated, which had no effect.

-- トリガー関数: RPC として呼び出されるべきではない
REVOKE EXECUTE ON FUNCTION public.handle_new_user_favorites() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_song_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_favorite_playlist_deletion() FROM PUBLIC, anon, authenticated;

-- 管理用関数: cron / service_role からのみ呼び出すべき
REVOKE EXECUTE ON FUNCTION public.refresh_ranking_stats() FROM PUBLIC, anon, authenticated;

-- register_full_archive_transaction: 認証ユーザーのみ
REVOKE EXECUTE ON FUNCTION public.register_full_archive_transaction(
  text, text, text, text, timestamptz, integer, boolean, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_full_archive_transaction(
  text, text, text, text, timestamptz, integer, boolean, text, jsonb
) TO authenticated;

-- rls_auto_enable: 存在する場合のみ実行（Supabase 自動生成の可能性）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
