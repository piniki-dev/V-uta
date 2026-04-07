-- 既存の関数を再定義して、お気に入りプレイリストの slug 重複問題を修正
CREATE OR REPLACE FUNCTION public.handle_new_user_favorites()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.playlists (name, description, is_favorites, created_by, is_public, slug)
  VALUES (
    'お気に入りした曲', 
    'お気に入りした楽曲がここに表示されます', 
    true, 
    NEW.id, 
    false, 
    'favorites-' || NEW.id -- UUID を含めることで一意性を確保
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
