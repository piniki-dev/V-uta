-- ==========================================
-- RLS Performance Optimization Migration
-- ==========================================

-- 1. productions
DROP POLICY IF EXISTS "productions_insert_auth" ON public.productions;
CREATE POLICY "productions_insert_auth" ON public.productions FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 2. vtubers
DROP POLICY IF EXISTS "vtubers_insert_auth" ON public.vtubers;
CREATE POLICY "vtubers_insert_auth" ON public.vtubers FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 3. channels
DROP POLICY IF EXISTS "channels_insert_auth" ON public.channels;
CREATE POLICY "channels_insert_auth" ON public.channels FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 4. videos
DROP POLICY IF EXISTS "videos_insert_auth" ON public.videos;
CREATE POLICY "videos_insert_auth" ON public.videos FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 5. master_songs
DROP POLICY IF EXISTS "master_songs_insert_auth" ON public.master_songs;
CREATE POLICY "master_songs_insert_auth" ON public.master_songs FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 6. songs (Optimizing evaluation and resolving multiple permissive policies)
DROP POLICY IF EXISTS "songs_mutations_auth" ON public.songs;
-- Restrict to INSERT, UPDATE, DELETE to avoid duplication with "songs_select_all" for SELECT.
CREATE POLICY "songs_mutations_auth" ON public.songs FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "songs_mutations_auth_update" ON public.songs FOR UPDATE USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "songs_mutations_auth_delete" ON public.songs FOR DELETE USING ((SELECT auth.uid()) IS NOT NULL);

-- 7. songs_history
DROP POLICY IF EXISTS "songs_history_select_auth" ON public.songs_history;
DROP POLICY IF EXISTS "songs_history_insert_auth" ON public.songs_history;
CREATE POLICY "songs_history_select_auth" ON public.songs_history FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "songs_history_insert_auth" ON public.songs_history FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 8. playlists
DROP POLICY IF EXISTS "playlists_select_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_policy" ON public.playlists;

CREATE POLICY "playlists_select_policy" ON public.playlists FOR SELECT USING (is_public = true OR (SELECT auth.uid()) = created_by);
CREATE POLICY "playlists_insert_policy" ON public.playlists FOR INSERT WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "playlists_update_policy" ON public.playlists FOR UPDATE USING ((SELECT auth.uid()) = created_by);
CREATE POLICY "playlists_delete_policy" ON public.playlists FOR DELETE USING ((SELECT auth.uid()) = created_by);

-- 9. playlist_items (Optimizing evaluation and resolving multiple permissive policies)
DROP POLICY IF EXISTS "playlist_items_select_policy" ON public.playlist_items;
DROP POLICY IF EXISTS "playlist_items_modify_policy" ON public.playlist_items;

CREATE POLICY "playlist_items_select_policy" ON public.playlist_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND (is_public = true OR (SELECT auth.uid()) = created_by)
  )
);
-- Restrict to INSERT, UPDATE, DELETE (via ALL using separated operations to be clear OR just excluding SELECT if possible, but ALL is easier to split)
-- Splitting ALL into INSERT, UPDATE, DELETE to avoid SELECT redundancy.
CREATE POLICY "playlist_items_insert_policy" ON public.playlist_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND (SELECT auth.uid()) = created_by
  )
);
CREATE POLICY "playlist_items_update_policy" ON public.playlist_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND (SELECT auth.uid()) = created_by
  )
);
CREATE POLICY "playlist_items_delete_policy" ON public.playlist_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND (SELECT auth.uid()) = created_by
  )
);

-- 10. play_history
DROP POLICY IF EXISTS "play_history_all_policy" ON public.play_history;
CREATE POLICY "play_history_all_policy" ON public.play_history FOR ALL USING ((SELECT auth.uid()) = user_id);
